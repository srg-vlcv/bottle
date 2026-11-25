import './style.css';
import { BALANCE, type BonusId } from './config/balance';
import { chapterLevel, chapterLevelIds, eventLevel, findLevel, nextLevel, type PlayLevel } from './content/levels';
import { themeBackground } from './content/assets';
import { CHARACTERS, DIALOGS } from './content/dialogs';
import { getTheme } from './content/themes';
import { nextAdCooldown } from './core/adchain';
import { grantAchievements } from './core/achievements';
import { claimDaily, dailyStatus, dayIndex } from './core/daily';
import { eventForDay, moveLimitFor } from './core/events';
import { CooldownClock, formatMMSS } from './core/cooldown';
import { addBonus, consumeBonus, levelReward } from './core/economy';
import type { FreePlayCategory } from './core/freeplay';
import { Game } from './core/game';
import { starsFor } from './core/generator';
import { chapterDone, firstUnfinishedIndex, isDone, totalStars } from './core/progress';
import { regenRemainingMs, tickRegen } from './core/regen';
import { restoreGame, sessionOf } from './core/session';
import { createRng } from './core/rng';
import { boardFromRows, isComplete, legalMoves } from './core/rules';
import { applyRewards, buyBonusCoins, buyBonusRare, buyChest, buyTheme, openChest, setActiveTheme } from './core/shop';
import { GameScene } from './render/scene';
import { AudioService } from './services/audio';
import { setLang, t, type Lang } from './services/i18n';
import { Analytics } from './services/analytics';
import { Haptics } from './services/haptics';
import { PaymentsService } from './services/payments';
import { SaveManager } from './services/save';
import { SolverService } from './services/solverService';
import { createSdk, type CatalogItem } from './services/yandexSdk';
import { el } from './ui/dom';
import { showChestWindow } from './ui/chestWindow';
import { showDialog } from './ui/dialog';
import { Hud } from './ui/hud';
import { buildAchievements, buildFreeSelect, buildLeaderboard, buildLevelSelect, buildMenu, buildShop, buildSplash, showDaily, showEvent, showOutOfBonus, showPause, showSettings, showStuck, showWin, type ShopTab } from './ui/screens';

type Mode = 'menu' | 'chapters' | 'free' | 'shop' | 'achievements' | 'rating' | 'play';
const DEMO = boardFromRows([[0, 3, 5, 1], [5, 1, 0, 3], [1, 5, 3, 0]], 4);
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Сундук за прохождение главы: к концу сюжета награда выше. */
const chapterChestTier = (chapter: number): 'silver' | 'gold' => (chapter >= 3 ? 'gold' : 'silver');

const defaultStats = () => ({ pours: 0, levelsWon: 0, noUndoWins: 0, adsWatched: 0, chestsOpened: 0, dailyClaims: 0, eventsWon: 0, hintsUsed: 0 });

async function boot(): Promise<void> {
  // three.js требует WebGL2: на совсем старых устройствах показываем понятное сообщение вместо пустого экрана
  if (!document.createElement('canvas').getContext('webgl2')) {
    const ru = !navigator.language.toLowerCase().startsWith('en');
    document.getElementById('ui')!.innerHTML = `<div class="loading" style="animation:none"><div style="padding:24px;text-align:center">${ru ? 'Эта игра требует WebGL2. Обновите браузер или откройте игру на другом устройстве.' : 'This game needs WebGL2. Please update your browser or try another device.'}</div></div>`;
    return;
  }
  const sdk = createSdk();
  await sdk.init().catch(() => undefined);
  const save = new SaveManager(sdk);
  await save.load();
  let lang: Lang = save.data.settings.lang ?? sdk.lang();
  setLang(lang);
  const applyThemeDom = (id: string): void => {
    const th = getTheme(id);
    for (const [k, v] of Object.entries(th.css)) document.documentElement.style.setProperty(`--${k}`, v);
    const bg = themeBackground(th.id, window.innerWidth / window.innerHeight >= 1.25);
    document.documentElement.style.setProperty('--bgimg', bg ? `url(${bg})` : 'none');
  };
  if (!save.data.themes.owned.includes(save.data.themes.active)) save.update((s) => ({ ...s, themes: { ...s.themes, active: 'lab' } }));
  const startTheme = getTheme(save.data.themes.active);
  applyThemeDom(startTheme.id);

  const audio = new AudioService();
  audio.setSound(save.data.settings.sound); audio.setMusic(save.data.settings.music); audio.setMusicStyle(startTheme.music);
  const analytics = new Analytics();
  const haptics = new Haptics(); haptics.enabled = save.data.settings.vibration;
  const debug = new URLSearchParams(location.search).has('debug');
  analytics.debug = debug;
  const solver = new SolverService();
  const payments = new PaymentsService(sdk, () => save.data, (fn) => save.update(fn), () => save.flush());
  const clock = new CooldownClock({ wall: () => sdk.serverTime(), mono: () => performance.now() }, save.data.adCooldown);
  const uiRoot = document.getElementById('ui')!;
  const scene = new GameScene(document.getElementById('stage')!, startTheme, (i) => void onTap(i));
  scene.setColorblind(save.data.settings.colorblind);

  let mode: Mode = 'menu';
  let screen: HTMLElement | null = null;
  let hud: Hud | null = null;
  let game: Game | null = null;
  let cur: PlayLevel | null = null;
  let par = 1;
  let sel: number | null = null;
  let loadSeq = 0, moveToken = 0;
  let chapterTab = 1;
  let freeCat: FreePlayCategory | null = null;
  let shopTab: ShopTab = 'chests';
  let catalog: CatalogItem[] | null = null;
  let purchasing = false;
  let hintBusy = false, stuckOpen = false;
  let lastFullscreenAt = 0;
  let dailyShown = false;
  let lastWide = window.innerWidth / window.innerHeight >= 1.25;

  /** ПК/планшет: интерфейс масштабируется от высоты окна (на телефоне остаётся как есть). */
  const applyUiScale = (): void => {
    const w = window.innerWidth, h = window.innerHeight;
    const z = Math.max(1, Math.min(h / 700, w / 420, 1.7));
    document.documentElement.style.setProperty('--z', z.toFixed(3));
    const wide = w / h >= 1.25;
    if (wide !== lastWide) { lastWide = wide; applyThemeDom(save.data.themes.active); } // телефон ↔ ПК: другой фон
    if (mode === 'menu') menuShift();
  };
  /** В меню на широком экране бутылки уходят вправо (меню слева), на телефоне — вверх над кнопками. */
  function menuShift(): void { const wide = scene.aspect >= 1.25; scene.setShift(wide ? 0.0 : 0.14, wide ? 0.2 : 0); }
  window.addEventListener('resize', applyUiScale);
  const today = (): number => dayIndex(clock.now(), new Date().getTimezoneOffset());
  let nudgeTimer = 0;

  // ---------- общие помощники ----------
  const setScreen = (next: HTMLElement | null): void => { screen?.remove(); screen = next; if (next) uiRoot.append(next); };
  const toast = (text: string): void => {
    if (hud) { hud.toast(text); return; }
    uiRoot.querySelector('.toast')?.remove();
    const d = el('div', 'toast'); d.textContent = text; uiRoot.append(d); setTimeout(() => d.remove(), 2200);
  };
  /** Показывает «Готовим уровень…» только если ожидание заметно (>150 мс). */
  async function withLoading<T>(p: Promise<T>): Promise<T> {
    let box: HTMLElement | null = null;
    const timer = window.setTimeout(() => {
      box = el('div', 'loading', `<div class="spinner"></div><div>${t('loading')}</div>`); uiRoot.append(box);
    }, 150);
    try { return await p; } finally { window.clearTimeout(timer); (box as HTMLElement | null)?.remove(); }
  }
  const levelLabel = (d: PlayLevel): string => (d.kind === 'event' ? t('eventLabel') : d.kind === 'free' ? `${t(`cat.${d.cat!}`)} · ${d.num}` : `${t('levelN')} ${d.num}`);
  const buildHud = (): Hud => new Hud(uiRoot, {
    undo: () => useUndo(), hint: () => void useHint(), extra: () => useExtra(), restart: () => restartLevel(), ad: () => void claimAd(BALANCE.rewardedAd.reward), pause: () => openPause(),
  });
  const bonusName = (id: BonusId): string => t(id === 'extraBottle' ? 'extra' : id);
  /** Запасы бонусов и обратные отсчёты восстановления. */
  function updateBonusHud(): void {
    if (!hud) return;
    const now = clock.now();
    for (const id of ['undo', 'hint'] as const) {
      const rem = regenRemainingMs(save.data, id, now);
      hud.setBonus(id, save.data.bonuses[id], rem !== null ? formatMMSS(rem) : null);
    }
    hud.setBonus('extra', save.data.bonuses.extraBottle, null);
  }
  function refreshHud(): void {
    if (!hud || !game) return;
    hud.setMoves(game.moves, cur?.moveLimit);
    hud.setStars(cur && cur.kind !== 'event' ? starsFor(game.moves, par, BALANCE.stars.three, BALANCE.stars.two) : null);
    hud.setCurrencies(save.data.coins, save.data.rare);
    updateBonusHud();
  }

  /** Выдаёт награды за новые достижения и сообщает об этом. */
  function checkAchievements(): void {
    const r = grantAchievements(save.data);
    if (r.unlocked.length === 0) return;
    save.update(() => r.save, 'urgent'); refreshHud();
    audio.bonus(); haptics.bonus();
    for (const a of r.unlocked) analytics.track('achievement', { id: a.id });
    const first = r.unlocked[0]!;
    toast(`${t('unlockedAch')}: ${first.title[lang]}${r.unlocked.length > 1 ? ` (+${r.unlocked.length - 1})` : ''}`);
  }
  const bumpStat = (k: keyof ReturnType<typeof defaultStats>, n = 1): void => save.update((s) => ({ ...s, stats: { ...s.stats, [k]: s.stats[k] + n } }));

  /** Короткая сюжетная вставка; каждая показывается один раз. */
  async function playDialog(key: string): Promise<void> {
    const lines = DIALOGS[key];
    if (!lines || save.data.seenDialogs.includes(key)) return;
    save.update((s) => ({ ...s, seenDialogs: [...s.seenDialogs, key] }));
    await new Promise<void>((resolve) => {
      showDialog(uiRoot, lines.map((l) => ({ who: l.who, mood: l.mood, name: CHARACTERS[l.who][lang], text: l[lang] })), resolve);
    });
  }

  // ---------- навигация ----------
  function startNudge(): void { window.clearInterval(nudgeTimer); nudgeTimer = window.setInterval(() => { if (mode === 'menu') scene.nudge(); }, 3200); }

  /** Игрок ушёл с незаконченного уровня — фиксируем (где бросают). */
  function trackQuit(): void { if (mode === 'play' && game && !game.won && cur) analytics.track('level_quit', { id: cur.id, moves: game.moves }); }

  function goMenu(): void {
    trackQuit();
    mode = 'menu'; hud?.destroy(); hud = null; game = null; cur = null; sel = null; loadSeq++; moveToken++; stuckOpen = false;
    sdk.gameplayStop();
    menuShift(); scene.setBoard(DEMO);
    setScreen(buildMenu({
      save: save.data, hasProgress: save.data.lastLevel !== null || Object.keys(save.data.progress).length > 0,
      onPlay: continueGame, onChapters: () => goChapters(chapterTab), onFree: () => goFree(null), onShop: () => goShop('chests'), onSettings: () => openSettings(() => undefined),
      onDaily: openDaily, onEvent: () => void openEvent(), onAchievements: goAchievements, onRating: () => void goRating(),
      dailyReady: dailyStatus(save.data.daily, today()).canClaim,
      eventReady: !(save.data.event.day === today() && save.data.event.done),
    }));
    startNudge();
  }

  function goChapters(id: number): void {
    trackQuit();
    mode = 'chapters'; chapterTab = id; hud?.destroy(); hud = null; game = null; loadSeq++;
    setScreen(buildLevelSelect({ save: save.data, chapterId: id, onBack: goMenu, onChapter: goChapters, onPick: (l) => void startLevel(l) }));
  }

  function goFree(cat: FreePlayCategory | null): void {
    trackQuit();
    mode = 'free'; freeCat = cat; hud?.destroy(); hud = null; game = null; loadSeq++;
    setScreen(buildFreeSelect({ save: save.data, cat, onBack: goMenu, onCat: goFree, onPick: (l) => void startLevel(l) }));
  }

  // ---------- награда, событие, достижения, рейтинг ----------
  function openDaily(): void {
    showDaily(uiRoot, {
      status: dailyStatus(save.data.daily, today()),
      onClaim: () => {
        const r = claimDaily(save.data, today());
        if (!r) return null;
        save.update(() => r.save, 'urgent'); audio.bonus(); checkAchievements();
        analytics.track('daily_claim', { day: r.status.dayInCycle, streak: r.status.streakAfter });
        return r.status.rewards;
      },
      onClose: () => { if (mode === 'menu') goMenu(); },
    });
  }

  /** Событие дня: награда случайна (одинакова у всех в этот день), сложность и лимит ходов зависят от её ценности. */
  async function openEvent(): Promise<void> {
    const day = today(), ev = eventForDay(day);
    const done = save.data.event.day === day && save.data.event.done;
    let gen;
    try { gen = await withLoading(solver.level(ev.spec, ev.seed)); } catch { toast(t('levelLoadFailed')); return; }
    const limit = moveLimitFor(gen.par, ev.limitFactor); // лимит известен заранее — показываем до старта
    showEvent(uiRoot, { ev, moveLimit: limit, done, onPlay: () => { analytics.track('event_start', { day, tier: ev.tier }); void startLevel(eventLevel(ev, limit)); } });
  }

  function goAchievements(): void {
    trackQuit();
    mode = 'achievements'; hud?.destroy(); hud = null; game = null; loadSeq++;
    setScreen(buildAchievements({ save: save.data, onBack: goMenu }));
  }

  async function goRating(): Promise<void> {
    trackQuit();
    mode = 'rating'; hud?.destroy(); hud = null; game = null; loadSeq++;
    const render = (entries: Parameters<typeof buildLeaderboard>[0]['entries']): void => {
      if (mode !== 'rating') return;
      setScreen(buildLeaderboard({ entries, authorized: sdk.isAuthorized(), onBack: goMenu, onAuth: () => void sdk.openAuth().then(() => { void sdk.setLeaderboardScore('stars', totalStars(save.data.progress)); void goRating(); }) }));
    };
    render('loading');
    render(await sdk.getLeaderboard('stars'));
  }

  // ---------- магазин и сундуки ----------
  function goShop(tab: ShopTab = shopTab): void {
    trackQuit();
    mode = 'shop'; shopTab = tab; hud?.destroy(); hud = null; game = null; loadSeq++;
    setScreen(buildShop({
      save: save.data, tab, catalog, onBack: goMenu, onTab: goShop,
      onBuyChest: (tier) => {
        const r = buyChest(save.data, tier);
        if (r.result !== 'ok') { toast(t('notEnoughRare')); return; }
        save.update(() => r.save, 'urgent'); audio.bonus(); goShop();
      },
      onOpenChest: (tier) => showChestWindow(uiRoot, {
        tier, owned: save.data.chests[tier],
        onOpen: () => {
          const r = openChest(save.data, tier, createRng((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0));
          if (!r) return null;
          analytics.track('chest_open', { tier });
          save.update(() => r.save); bumpStat('chestsOpened'); void save.flush(); checkAchievements(); // результат сохраняем до анимации — закрытие игры не отнимет награду
          audio.bonus();
          return r.rewards;
        },
        onClose: () => { if (mode === 'shop') goShop(); },
      }),
      onBuyBonus: (id, cur) => {
        const r = cur === 'rare' ? buyBonusRare(save.data, id) : buyBonusCoins(save.data, id);
        if (r.result !== 'ok') { toast(t(r.result === 'not_enough_coins' ? 'notEnoughCoins' : 'notEnoughRare')); return; }
        save.update(() => r.save, 'urgent'); audio.bonus(); goShop();
      },
      onBuyProduct: (id) => void buyProduct(id),
      onBuyTheme: (id, cur) => {
        const r = buyTheme(save.data, id, cur);
        if (r.result !== 'ok') { toast(t(r.result === 'not_enough_coins' ? 'notEnoughCoins' : 'notEnoughRare')); return; }
        save.update(() => r.save, 'urgent'); audio.bonus(); checkAchievements(); goShop();
      },
      onApplyTheme: (id) => {
        save.update((s) => setActiveTheme(s, id));
        const th = getTheme(id);
        analytics.track('theme_apply', { id });
        applyThemeDom(id); audio.setMusicStyle(th.music); scene.setTheme(th); audio.click();
        goShop();
      },
    }));
    if (tab === 'currency' && catalog === null) {
      void payments.catalog().then((c) => { catalog = c; if (mode === 'shop' && shopTab === 'currency') goShop('currency'); });
    }
  }

  async function buyProduct(id: string): Promise<void> {
    if (purchasing) return;
    purchasing = true;
    try {
      const r = await withAdPause(() => payments.buy(id)); // на время платёжного окна — пауза и mute
      analytics.track(r.ok ? 'purchase_ok' : 'purchase_fail', { id, ...(r.ok ? {} : { reason: r.reason }) });
      if (r.ok) { audio.bonus(); toast(t('purchaseOk')); goShop(); }
      else toast(t(r.reason === 'cancelled' ? 'purchaseCancelled' : r.reason === 'unavailable' ? 'paymentsOff' : 'purchaseFailed'));
    } finally { purchasing = false; }
  }

  function continueGame(): void {
    const last = save.data.lastLevel ? findLevel(save.data.lastLevel) : null;
    let target: PlayLevel | null;
    if (last) target = isDone(save.data.progress, last.id) ? nextLevel(last) : last;
    else target = chapterLevel(1, firstUnfinishedIndex(save.data.progress, chapterLevelIds(1)));
    if (target) void startLevel(target); else goChapters(chapterTab);
  }

  function backToList(): void {
    if (cur?.kind === 'free') goFree(cur.cat!); else if (cur?.kind === 'chapter') goChapters(cur.chapterId ?? 1); else goMenu();
  }

  async function startLevel(def: PlayLevel): Promise<void> {
    const seq = ++loadSeq;
    window.clearInterval(nudgeTimer);
    let gen;
    try { gen = await withLoading(solver.level(def.spec, def.seed, def.minPar)); } catch { toast(t('levelLoadFailed')); return; }
    if (seq !== loadSeq) return; // пока грузили, игрок ушёл
    mode = 'play'; cur = def; par = gen.par; game = new Game(gen.board); sel = null; stuckOpen = false; moveToken++;
    // Незаконченный уровень продолжается с того же места (доска восстанавливается переигрыванием ходов).
    let resumed = false;
    const ss = save.data.session;
    if (ss && ss.id === def.id) {
      const restored = restoreGame(gen.board, ss);
      if (restored) { game = restored; resumed = restored.moves > 0 || restored.extraAts.length > 0; } else save.update((s) => ({ ...s, session: null }));
    } else if (ss) save.update((s) => ({ ...s, session: null }));
    analytics.track('level_start', { id: def.id, resumed });
    setScreen(null);
    scene.setShift(0); scene.setBoard(game.board);
    hud?.destroy(); hud = buildHud();
    hud.setLevel(levelLabel(def));
    hud.setTip(def.tutorial ? t(def.tutorial) : def.moveLimit !== undefined ? `${t('eventLimit')}: ${def.moveLimit}` : null);
    refreshHud();
    if (resumed) toast(t('resumed'));
    if (def.kind !== 'event') save.update((s) => ({ ...s, lastLevel: def.id }));
    if (def.kind === 'chapter') await playDialog(`${def.id}:before`);
    if (seq !== loadSeq || mode !== 'play') return;
    sdk.gameplayStart();
    // Обучение: рука показывает первый ход (ход берём у солвера)
    if (def.tutorial === 'tut.firstPour' && game.moves === 0) {
      const g0 = game;
      void solver.hint(g0.board).then((m) => { if (m && game === g0 && mode === 'play' && sel === null && g0.moves === 0) scene.showPointer(m.from, m.to); }).catch(() => undefined);
    }
    const nx = nextLevel(def);
    if (nx) solver.prefetch(nx.spec, nx.seed, nx.minPar); // следующий уровень считается в фоне
  }

  // ---------- игровой процесс ----------
  async function onTap(i: number): Promise<void> {
    const g = game;
    if (mode !== 'play' || !g || scene.busy || g.won) return;
    scene.clearHint();
    const tapped = g.board.bottles[i]!;
    if (tapped.locked) { // запечатанная: встряска + подсветка бутылки-ключа + подсказка
      scene.shake(i); scene.pulseBottle(tapped.lockedBy ?? i); audio.error(); haptics.error(); toast(t('sealedHint'));
      return;
    }
    if (sel === null) {
      if (g.board.bottles[i]!.layers.length === 0) { scene.shake(i); audio.error(); haptics.error(); return; }
      sel = i; scene.select(i); audio.select(); haptics.select(); return;
    }
    if (sel === i) { void scene.deselect(i); sel = null; return; }
    const from = sel; sel = null;
    const before = g.board;
    if (g.tryMove(from, i) === 'invalid') { void scene.deselect(from); scene.shake(i); audio.error(); haptics.error(); return; }
    hud?.setTip(null);
    const move = g.history[g.history.length - 1]!;
    save.update((s) => ({ ...s, stats: { ...s.stats, pours: s.stats.pours + 1 } }));
    if (cur) save.update((s) => ({ ...s, session: sessionOf(cur!.id, g) }), 'local'); // продолжение уровня — достаточно локально
    const token = ++moveToken;
    await scene.pour(before, move, g.board, { onStream: (d) => { audio.pour(d); haptics.pour(); } });
    if (mode !== 'play' || game !== g) return; // игрок вышел во время анимации
    refreshHud();
    if (isComplete(g.board.bottles[i]!)) { audio.complete(); haptics.complete(); }
    if (g.won) { await onWin(); return; }
    if (cur?.moveLimit !== undefined && g.moves >= cur.moveLimit) { openStuck(true); return; } // лимит ходов события
    checkStuck(token);
  }

  /** Тупик: сразу, если ходов нет; иначе фоновая проверка солвером (в воркере). */
  function checkStuck(token: number): void {
    const g = game; if (!g) return;
    if (legalMoves(g.board).length === 0) { openStuck(); return; }
    void solver.deadlock(g.board).then((r) => {
      if (r === 'deadlock' && token === moveToken && game === g && mode === 'play' && !g.won && !scene.busy) openStuck();
    }).catch(() => undefined);
  }

  function openStuck(outOfMoves = false): void {
    if (stuckOpen) return;
    stuckOpen = true;
    if (cur) analytics.track('level_stuck', { id: cur.id, moves: game?.moves ?? 0, limit: outOfMoves });
    const done = (fn: () => void) => () => { stuckOpen = false; fn(); };
    showStuck(uiRoot, { onUndo: done(useUndo), onExtra: done(useExtra), onRestart: done(restartLevel), outOfMoves });
  }

  async function onWin(): Promise<void> {
    const g = game!, def = cur!;
    sdk.gameplayStop(); audio.win(); haptics.win(); scene.celebrate(g.board);
    save.update((s) => ({ ...s, session: null }));
    analytics.track('level_win', { id: def.id, moves: g.moves, undo: g.undoUsed });

    if (def.kind === 'event') {
      // Событие дня: награда выдаётся один раз за сутки; звёзды и прогресс уровней не трогаем.
      const day = today(), first = !(save.data.event.day === day && save.data.event.done);
      if (first) {
        save.update((s) => ({ ...applyRewards(s, def.rewards ?? []), event: { day, done: true }, stats: { ...s.stats, eventsWon: s.stats.eventsWon + 1 } }), 'urgent');
        checkAchievements();
      }
      refreshHud();
      await sleep(1200);
      if (mode !== 'play' || game !== g) return;
      showWin(uiRoot, { stars: 0, coins: 0, chapterReward: null, chapterChest: null, hasNext: false, rewards: first ? def.rewards ?? [] : [] }, { onNext: () => undefined, onMenu: goMenu });
      return;
    }

    const stars = starsFor(g.moves, par, BALANCE.stars.three, BALANCE.stars.two);
    const coins = levelReward(stars, false);
    const prev = save.data.progress[def.id] ?? 0;
    const progressAfter = { ...save.data.progress, [def.id]: Math.max(prev, stars) };
    let chapterReward: number | null = null;
    const key = `chapter:${def.chapterId}`;
    if (def.kind === 'chapter' && chapterDone(progressAfter, chapterLevelIds(def.chapterId!)) && !save.data.achievements.includes(key)) {
      chapterReward = BALANCE.rewards.chapterRare;
    }
    save.update((s) => ({
      ...s, coins: s.coins + coins, rare: s.rare + (chapterReward ?? 0), progress: progressAfter,
      stats: { ...s.stats, levelsWon: s.stats.levelsWon + 1, noUndoWins: s.stats.noUndoWins + (g.undoUsed === 0 ? 1 : 0) },
      achievements: chapterReward !== null ? [...s.achievements, key] : s.achievements,
      chests: chapterReward !== null ? { ...s.chests, [chapterChestTier(def.chapterId ?? 1)]: s.chests[chapterChestTier(def.chapterId ?? 1)] + 1 } : s.chests,
    }), 'urgent');
    void sdk.setLeaderboardScore('stars', totalStars(progressAfter));
    refreshHud(); checkAchievements();
    await sleep(1200); // даём отыграть конфетти
    if (mode !== 'play' || game !== g) return;
    const nx = nextLevel(def);
    const afterKey = `${def.id}:after`;
    showWin(uiRoot, { stars, coins, chapterReward, chapterChest: chapterReward !== null ? chapterChestTier(def.chapterId ?? 1) : null, hasNext: !!nx }, {
      onNext: () => void playDialog(afterKey).then(() => goNext(nx!)),
      onMenu: () => void playDialog(afterKey).then(backToList),
    });
  }

  async function goNext(nx: PlayLevel): Promise<void> {
    const f = BALANCE.fullscreenAd; const won = save.data.stats.levelsWon;
    if (won >= f.firstLevelAllowed && won % f.everyNLevels === 0 && Date.now() - lastFullscreenAt >= f.minIntervalMs) {
      lastFullscreenAt = Date.now();
      await withAdPause(() => sdk.showFullscreen());
    }
    await startLevel(nx);
  }

  /** Пауза игры и звука на время рекламы. */
  async function withAdPause<T>(fn: () => Promise<T>): Promise<T> {
    sdk.gameplayStop(); audio.setMuted(true);
    try { return await fn(); } finally { audio.setMuted(document.hidden); if (mode === 'play') sdk.gameplayStart(); }
  }

  const persistSession = (): void => { if (cur && game) save.update((s) => ({ ...s, session: sessionOf(cur!.id, game!) }), 'local'); };

  // ---------- бонусы (глобальные запасы) ----------
  /** Бонус закончился: когда восстановится сам и можно ли взять за рекламу. */
  function openOutOfBonus(id: BonusId): void {
    const rem = id === 'extraBottle' ? null : regenRemainingMs(save.data, id, clock.now());
    showOutOfBonus(uiRoot, {
      name: bonusName(id),
      regenText: rem !== null ? formatMMSS(rem) : null,
      adCooldownText: clock.ready() ? null : formatMMSS(clock.remainingMs()),
      onAd: () => void claimAd(id),
      priceRare: BALANCE.bonuses[id].priceRare,
      canBuy: save.data.rare >= BALANCE.bonuses[id].priceRare,
      onBuy: () => {
        const r = buyBonusRare(save.data, id);
        if (r.result !== 'ok') return;
        save.update(() => r.save); audio.bonus(); refreshHud(); toast(`${t('bought')}: ${bonusName(id)} +1`);
      },
    });
  }
  function spend(id: BonusId): boolean {
    const next = consumeBonus(save.data, id, clock.now());
    if (!next) { openOutOfBonus(id); return false; }
    save.update(() => next); refreshHud(); return true;
  }
  function useUndo(): void {
    const g = game; if (!g || scene.busy || g.history.length === 0) return;
    if (!spend('undo')) return;
    g.undo(); sel = null; moveToken++; stuckOpen = false; scene.syncBoard(g.board); refreshHud(); audio.click(); persistSession();
  }
  async function useHint(): Promise<void> {
    const g = game; if (!g || scene.busy || g.won || hintBusy) return;
    if (save.data.bonuses.hint <= 0) { openOutOfBonus('hint'); return; }
    hintBusy = true;
    const m = await solver.hint(g.board).catch(() => null);
    hintBusy = false;
    if (game !== g || mode !== 'play' || scene.busy) return;
    if (!m) { toast(t('noHint')); return; }
    if (!spend('hint')) return;
    g.hintsUsed++; bumpStat('hintsUsed');
    // Источник сразу «взят в руку» — остаётся тапнуть по приёмнику (маркеры 1 → 2 показывают куда).
    if (sel !== null && sel !== m.from) void scene.deselect(sel);
    if (sel !== m.from) { scene.select(m.from); audio.select(); }
    sel = m.from;
    scene.showHint(m.from, m.to);
  }
  function useExtra(): void {
    const g = game; if (!g || scene.busy) return;
    if (g.extraBottlesUsed >= BALANCE.bonuses.extraBottle.maxPerLevel) { toast(t('limitExtra')); return; }
    if (!spend('extraBottle')) return;
    g.addExtraBottle(BALANCE.bonuses.extraBottle.maxPerLevel); sel = null; moveToken++; stuckOpen = false; scene.setBoard(g.board); persistSession();
  }
  function restartLevel(): void {
    const g = game; if (!g || scene.busy) return;
    g.restart(); sel = null; moveToken++; stuckOpen = false; scene.setBoard(g.board); refreshHud(); persistSession();
  }

  /**
   * Реклама за бонус: награда ТОЛЬКО при onRewarded; ошибка/досрочное закрытие кулдаун не запускают.
   * Кулдауны растут лесенкой 2 → 5 → 10 → 20 мин; общий для всех рекламных наград.
   */
  async function claimAd(id: BonusId): Promise<void> {
    if (!clock.ready()) { toast(`${t('adNotReady')} ${formatMMSS(clock.remainingMs())}`); return; }
    const r = await withAdPause(() => sdk.showRewarded());
    if (!(r.ok && r.rewarded)) { analytics.track('ad_failed', { kind: 'rewarded' }); toast(t('adFailed')); return; }
    analytics.track('ad_rewarded', { bonus: id });
    const chain = nextAdCooldown(save.data.adStep, clock.nextAvailableAt, clock.now(), BALANCE.rewardedAd);
    clock.start(chain.cooldownMs);
    save.update((s) => ({ ...addBonus(s, id), adStep: chain.step, adCooldown: clock.toSave(), stats: { ...s.stats, adsWatched: s.stats.adsWatched + 1 } }), 'urgent');
    refreshHud(); audio.bonus(); checkAchievements(); toast(`${t('adGot')}: ${bonusName(id)} +1`);
  }

  // ---------- пауза и настройки ----------
  function openPause(): void {
    showPause(uiRoot, { onResume: () => undefined, onRestart: restartLevel, onSettings: () => openSettings(openPause), onMenu: goMenu });
  }

  function openSettings(onClose: () => void): void {
    showSettings(uiRoot, {
      save: save.data, lang,
      onLang: (l) => {
        lang = l; setLang(l);
        save.update((s) => ({ ...s, settings: { ...s.settings, lang: l } }));
        rerender(); onClose();
      },
      onSound: (v) => { audio.setSound(v); save.update((s) => ({ ...s, settings: { ...s.settings, sound: v } })); if (v) audio.click(); },
      onMusic: (v) => { audio.setMusic(v); save.update((s) => ({ ...s, settings: { ...s.settings, music: v } })); },
      onVibration: (v) => { haptics.enabled = v; save.update((s) => ({ ...s, settings: { ...s.settings, vibration: v } })); if (v) haptics.select(); },
      onColorblind: (v) => { scene.setColorblind(v); save.update((s) => ({ ...s, settings: { ...s.settings, colorblind: v } })); },
    }, onClose);
  }

  /** Перерисовать текущий экран после смены языка. */
  function rerender(): void {
    if (mode === 'menu') goMenu();
    else if (mode === 'chapters') goChapters(chapterTab);
    else if (mode === 'free') goFree(freeCat);
    else if (mode === 'shop') goShop(shopTab);
    else if (mode === 'achievements') goAchievements();
    else if (mode === 'rating') void goRating();
    else if (hud && game && cur) { hud.destroy(); hud = buildHud(); refreshHud(); hud.setLevel(levelLabel(cur)); }
  }

  // ---------- глобальные обработчики ----------
  document.addEventListener('pointerdown', () => audio.unlock());
  uiRoot.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('button')) audio.click(); });
  const persistClock = (): void => save.update((s) => ({ ...s, adCooldown: clock.toSave() }), 'local');
  window.setInterval(() => {
    const now = clock.now();
    const next = tickRegen(save.data, now); // восстановление отмены/подсказки, в том числе за время «офлайн»
    if (next !== save.data) save.update(() => next);
    hud?.setAdCooldown(clock.ready() ? null : formatMMSS(clock.remainingMs()));
    updateBonusHud();
  }, 250);
  window.setInterval(persistClock, 30_000); // чтобы после перезапуска часы не откатывались
  window.addEventListener('pagehide', () => { persistClock(); void save.flush(); });
  document.addEventListener('visibilitychange', () => {
    audio.setMuted(document.hidden);
    if (document.hidden) { persistClock(); void save.flush(); } // перед сворачиванием — облако сразу
    if (document.hidden) sdk.gameplayStop(); else if (mode === 'play' && game && !game.won) sdk.gameplayStart();
  });

  { const next = tickRegen(save.data, clock.now()); if (next !== save.data) save.update(() => next); }
  if (debug) {
    // ?debug=1: FPS и счётчики рендера. Если geometries/textures растут от уровня к уровню — где-то не вызван dispose.
    const box = el('div', 'debug-box'); document.body.append(box);
    let frames = 0, last = performance.now();
    const tick = (): void => { frames++; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    window.setInterval(() => {
      const now = performance.now(), fps = Math.round((frames * 1000) / (now - last)); frames = 0; last = now;
      const st = scene.stats();
      box.textContent = `FPS ${fps} · bottles ${scene.bottleCount} · calls ${st.calls} · tris ${st.triangles} · geo ${st.geometries} · tex ${st.textures}`;
    }, 500);
    (window as unknown as { bottlesDebug: unknown }).bottlesDebug = { stats: () => analytics.levelStats(), events: (n?: number) => analytics.recent(n), save: () => save.data, scene: () => scene.stats() };
  }

  /** Старт игры после нажатия «Начать»: именно этот жест разрешает звук и музыку (требование площадки). */
  function startGame(): void {
    audio.unlock(); audio.click();
    goMenu();
    // Ежедневная награда всплывает сама (только у тех, кто уже играл — новичку не мешаем)
    if (!dailyShown && save.data.lastLevel !== null && dailyStatus(save.data.daily, today()).canClaim) { dailyShown = true; openDaily(); }
    void payments.recoverPending().then((n) => { if (n > 0) { toast(t('purchaseRestored')); if (mode === 'menu') goMenu(); } }); // добрать незавершённые покупки
  }

  // Заранее считаем уровень, с которого игрок продолжит, пока показывается заставка
  {
    const last = save.data.lastLevel ? findLevel(save.data.lastLevel) : null;
    const target = last ? (isDone(save.data.progress, last.id) ? nextLevel(last) : last) : chapterLevel(1, firstUnfinishedIndex(save.data.progress, chapterLevelIds(1)));
    if (target) solver.prefetch(target.spec, target.seed, target.minPar);
  }
  applyUiScale();
  menuShift(); scene.setBoard(DEMO); startNudge();
  document.getElementById('boot')?.remove();
  setScreen(buildSplash({ onStart: startGame }));
  sdk.loadingReady(); // игра загружена и готова к взаимодействию
}

void boot();

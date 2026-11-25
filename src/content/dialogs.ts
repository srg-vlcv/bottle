export type CharId = 'leo' | 'bulk' | 'note';
export type Mood = 'normal' | 'happy' | 'surprised' | 'think';

export interface DialogLine { who: CharId; mood: Mood; ru: string; en: string }

/** Имена персонажей (RU/EN). note — «рассказчик»: находки, записки, описание места. */
export const CHARACTERS: Record<CharId, { ru: string; en: string }> = {
  leo: { ru: 'Лео', en: 'Leo' },
  bulk: { ru: 'Бульк', en: 'Bulk' },
  note: { ru: '', en: '' },
};

const L = (who: CharId, mood: Mood, ru: string, en: string): DialogLine => ({ who, mood, ru, en });

/**
 * Ключ = `${levelId}:before` | `${levelId}:after`. Показывается один раз.
 * Сюжет: молодой химик Лео и лабораторный дух Бульк восстанавливают лабораторию профессора Элрика и ищут его.
 */
export const DIALOGS: Record<string, DialogLine[]> = {
  'ch1:l1:before': [
    L('note', 'normal', 'Заброшенная лаборатория профессора Элрика. Пыль, холод и десятки пустых колб.', 'The abandoned lab of Professor Elric. Dust, cold, and dozens of empty flasks.'),
    L('leo', 'think', 'Наставник пропал неделю назад… Значит, ответ где-то здесь. Начну с наведения порядка.', 'My mentor vanished a week ago… so the answer must be here. First, let me tidy up.'),
    L('bulk', 'surprised', 'Бульк! Кто-то пришёл! Я так долго пузырился тут один!', 'Blub! Someone is here! I have been bubbling alone for so long!'),
    L('leo', 'surprised', 'Ты… говоришь?!', 'You… talk?!'),
    L('bulk', 'happy', 'Я лабораторный дух Бульк. Профессор оставил меня стеречь эссенции. Разлей их по местам — и лаборатория оживёт!', 'I am Bulk, the lab spirit. The Professor left me to guard the essences. Sort them out and the lab will come alive!'),
    L('leo', 'happy', 'Договорились. Переливаем по цветам!', 'Deal. Let us pour by color!'),
  ],
  'ch1:l3:before': [
    L('bulk', 'normal', 'Видишь, цвета сами тянутся друг к другу? Профессор говорил: у каждой эссенции своё место.', 'See how the colors pull toward each other? The Professor said every essence has its place.'),
  ],
  'ch1:l6:after': [
    L('leo', 'surprised', 'Смотри, под колбой записка! «Если читаешь это — я у Источника. Никому не…» Дальше обгорело.', 'Look, a note under the flask! "If you are reading this, I am at the Spring. Trust no…" The rest is burnt.'),
    L('bulk', 'surprised', 'Источник?! Бульк-бульк… Это же легенда!', 'The Spring?! Blub-blub… that is a legend!'),
  ],
  'ch1:l9:before': [
    L('bulk', 'think', 'Дальше эссенции капризнее. Не бойся пустых колб — они твои друзья.', 'The essences get pickier from here. Do not fear empty flasks — they are your friends.'),
  ],
  'ch1:l12:after': [
    L('leo', 'happy', 'Всё больше колб светится! Лаборатория просыпается.', 'More and more flasks are glowing! The lab is waking up.'),
    L('bulk', 'happy', 'Профессор бы гордился!', 'The Professor would be proud!'),
  ],
  'ch1:l18:before': [
    L('bulk', 'surprised', 'Это Большой Реактор! Если разлить его эссенции правильно — откроется дверь в подвал.', 'This is the Great Reactor! Sort its essences correctly and the cellar door will open.'),
    L('leo', 'think', 'Подвал… Там наверняка ещё записки. Работаем.', 'The cellar… there must be more notes down there. Let us get to work.'),
  ],
  'ch1:l18:after': [
    L('note', 'normal', 'Дверь в подвал со скрипом открылась. Внизу пахло озоном и тайной.', 'The cellar door creaked open. Below, the air smelled of ozone and secrets.'),
    L('leo', 'think', 'Профессор, держись. Мы идём.', 'Hold on, Professor. We are coming.'),
    L('bulk', 'happy', 'И я иду! Бульк-бульк!', 'And I am coming too! Blub-blub!'),
  ],

  // ---------------- Глава 2 «Тайна наставника» ----------------
  'ch2:l1:before': [
    L('note', 'normal', 'Подвал встретил холодом. Колбы затянуло тёмной дымкой — цвета внутри не разобрать.', 'The cellar greeted them with cold. Dark haze clouded the flasks — the colors inside were a mystery.'),
    L('leo', 'think', 'Часть эссенций скрыта. Но если убрать верхний слой, следующий проявится.', 'Some essences are hidden. But once the top layer is gone, the next one will show.'),
    L('bulk', 'surprised', 'Знак «?» — профессор метил так свои секретные опыты!', 'The «?» mark — that is how the Professor labeled his secret experiments!'),
    L('leo', 'happy', 'Тогда будем разгадывать слой за слоем.', 'Then we will solve it layer by layer.'),
  ],
  'ch2:l5:after': [
    L('leo', 'surprised', 'Дневник! Страницы слиплись, но одна читается: «Источник под лабораторией питает всё. Я нашёл, как его удержать…»', 'A journal! The pages are stuck together, but one is legible: "The Spring under the lab feeds everything. I found a way to hold it…"'),
    L('bulk', 'think', 'Удержать? Звучит опасно.', 'Hold it? That sounds dangerous.'),
  ],
  'ch2:l10:before': [
    L('bulk', 'surprised', 'Тут темнее… Бульк-бульк, я боюсь!', 'It is darker here… blub-blub, I am scared!'),
    L('leo', 'normal', 'Держись рядом. Верхний слой — подсказка про нижний.', 'Stay close. The top layer is a hint about the one below.'),
  ],
  'ch2:l15:after': [
    L('note', 'normal', 'На стене проступили следы: кто-то спускался сюда до вас — и не раз.', 'Marks appeared on the wall: someone had come down here before — more than once.'),
    L('leo', 'think', 'Профессор? Или кто-то другой…', 'The Professor? Or someone else…'),
  ],
  'ch2:l20:before': [
    L('bulk', 'surprised', 'Это Туманный реактор! Все его слои скрыты!', 'This is the Fog Reactor! All of its layers are hidden!'),
    L('leo', 'normal', 'Осторожно: каждый ход открывает новую тайну.', 'Careful: every move reveals a new secret.'),
  ],
  'ch2:l20:after': [
    L('note', 'normal', 'За реактором — тяжёлая дверь с резным знаком капли. Она ведёт в Хранилище запретных эссенций.', 'Behind the reactor stood a heavy door carved with a drop. It led to the Vault of Forbidden Essences.'),
    L('leo', 'happy', 'Профессор там. Я чувствую.', 'The Professor is in there. I can feel it.'),
    L('bulk', 'happy', 'Тогда вперёд! Бульк!', 'Then let us go! Blub!'),
  ],

  // ---------------- Глава 3 «Запретные эссенции» ----------------
  'ch3:l1:before': [
    L('note', 'normal', 'В Хранилище стоят старинные пробирки разного размера. Каждая рассчитана на свою эссенцию.', 'The Vault holds ancient vials of different sizes. Each one was made for its own essence.'),
    L('bulk', 'think', 'Маленькие хранят редкое, большие — обычное. У каждой свой объём!', 'Small ones keep the rare, large ones the common. Each has its own volume!'),
    L('leo', 'normal', 'Значит, цвет должен лечь в пробирку, которую он заполнит целиком.', 'So each color must go into the vial it fills completely.'),
  ],
  'ch3:l7:after': [
    L('leo', 'surprised', 'Карта! Тоннель к Источнику ведёт от Хранилища.', 'A map! The tunnel to the Spring starts from the Vault.'),
    L('bulk', 'surprised', 'А в конце — печати профессора на двери…', 'And at the end — the Professor\'s seals on the door…'),
  ],
  'ch3:l13:before': [
    L('bulk', 'think', 'Запретные эссенции нельзя смешивать, Лео. Совсем.', 'Forbidden essences must never be mixed, Leo. Never.'),
    L('leo', 'normal', 'Обещаю: каждая — в свою колбу.', 'I promise: each one in its own flask.'),
  ],
  'ch3:l20:before': [
    L('note', 'normal', 'Последняя полка. Эссенции здесь шепчут, будто знают, зачем вы пришли.', 'The last shelf. The essences whisper here, as if they know why you came.'),
    L('bulk', 'surprised', 'Они знают про Источник!', 'They know about the Spring!'),
  ],
  'ch3:l20:after': [
    L('note', 'normal', 'За стеной зашумела вода. Тоннель к Источнику открыт. Но дверь в конце запечатана воском с печатью наставника.', 'Water roared behind the wall. The tunnel to the Spring was open. But the door at its end was sealed with the mentor\'s wax.'),
    L('leo', 'think', 'Печати. Профессор запер что-то… или кого-то.', 'Seals. The Professor locked something away… or someone.'),
  ],

  // ---------------- Глава 4 «Последний эксперимент» ----------------
  'ch4:l1:before': [
    L('note', 'normal', 'Зал Источника. Колбы запечатаны воском: каждая откроется, лишь когда будет собрана её колба-ключ.', 'The Spring Hall. The flasks are sealed with wax: each opens only once its key flask is complete.'),
    L('leo', 'normal', 'Печать снимется, когда соберу нужный цвет. Понял, Бульк?', 'The seal breaks when I complete the right color. Got it, Bulk?'),
    L('bulk', 'happy', 'Бульк! Ключ — собранная бутылка!', 'Blub! The key is a completed bottle!'),
  ],
  'ch4:l8:after': [
    L('leo', 'surprised', 'Слышишь? Кто-то стучит из-за стены!', 'Do you hear that? Someone is knocking behind the wall!'),
    L('bulk', 'surprised', 'Профессор?!', 'The Professor?!'),
  ],
  'ch4:l15:before': [
    L('bulk', 'think', 'Кто-то запечатал колбы нарочно. Чтобы Источник не достался нам.', 'Someone sealed the flasks on purpose. So the Spring would not reach us.'),
    L('leo', 'think', 'Или чтобы он не достался никому.', 'Or so it would not reach anyone at all.'),
  ],
  'ch4:l22:before': [
    L('note', 'normal', 'Последняя печать — на Сердце Источника. За ней тишина, и чьё-то дыхание.', 'The final seal was on the Heart of the Spring. Behind it — silence, and someone breathing.'),
    L('leo', 'normal', 'Это мой наставник. Держись, профессор.', 'That is my mentor. Hold on, Professor.'),
  ],
  'ch4:l22:after': [
    L('note', 'normal', 'Печать треснула. Свет залил зал — и из него шагнул профессор Элрик, усталый, но живой.', 'The seal cracked. Light flooded the hall — and Professor Elric stepped out of it, weary but alive.'),
    L('leo', 'happy', 'Профессор!', 'Professor!'),
    L('bulk', 'happy', 'Бульк-бульк-БУЛЬК!', 'Blub-blub-BLUB!'),
    L('note', 'normal', '«Я запечатал Источник, чтобы его не осушили, — улыбнулся Элрик. — Вы справились лучше, чем я мечтал».', '"I sealed the Spring so it would not be drained," Elric smiled. "You did better than I ever dreamed."'),
    L('note', 'normal', 'Но на дне Источника что-то блеснуло. Приключение продолжается…', 'But something glimmered at the bottom of the Spring. The adventure continues…'),
  ],
};

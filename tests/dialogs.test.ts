import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIALOGS } from '../src/content/dialogs';
import { chapterLevel } from '../src/content/levels';

test('диалоги: ключи указывают на существующие уровни, везде есть RU и EN', () => {
  for (const [key, lines] of Object.entries(DIALOGS)) {
    const m = /^(ch(\d+):l(\d+)):(before|after)$/.exec(key);
    assert.ok(m, `плохой ключ ${key}`);
    assert.ok(chapterLevel(Number(m![2]), Number(m![3]) - 1), `нет уровня для ${key}`);
    assert.ok(lines.length >= 1 && lines.length <= 6, `${key}: длина вставки`);
    for (const l of lines) {
      assert.ok(l.ru.trim().length > 0 && l.en.trim().length > 0, `${key}: пустой текст`);
      assert.ok(l.ru.length < 200 && l.en.length < 200, `${key}: слишком длинная реплика`);
    }
  }
});

test('Глава 1 заканчивается сюжетной вставкой, а начинается знакомством', () => {
  assert.ok(DIALOGS['ch1:l1:before']);
  assert.ok(DIALOGS['ch1:l18:after']);
});

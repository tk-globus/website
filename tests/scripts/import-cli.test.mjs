// Командний рядок імпортера: правильні аргументи → параметри; помилка — одне зрозуміле речення, без стеку.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { CliError, parseCli } from '../../scripts/import/cli.mjs';

const TYPES = ['news', 'events', 'reports', 'pages'];

test('правильні аргументи', () => {
  assert.deepEqual(parseCli(['news'], TYPES), { typeName: 'news', scope: 'sample', limit: undefined, refresh: false, root: '.' });
  assert.deepEqual(parseCli(['events', '--scope', 'all', '--limit', '3', '--refresh'], TYPES), {
    typeName: 'events',
    scope: 'all',
    limit: 3,
    refresh: true,
    root: '.',
  });
});

test('помилки в аргументах — CliError із поясненням українською', () => {
  const cases = [
    [[], /вкажіть тип контенту: news, events, reports, pages/],
    [['foo'], /невідомий тип «foo»/],
    [['news', 'events'], /зайвий аргумент «events»/],
    [['news', '--scope', 'foo'], /невідомий обсяг «foo»: --scope sample .* або --scope all/],
    [['news', '--scope'], /параметру --scope бракує значення/],
    [['news', '--foo'], /невідомий параметр --foo/],
    [['news', '--limit', 'abc'], /--limit має бути цілим числом/],
    [['news', '--limit', '0'], /--limit має бути цілим числом/],
  ];
  for (const [argv, message] of cases) {
    assert.throws(() => parseCli(argv, TYPES), (e) => e instanceof CliError && message.test(e.message), argv.join(' '));
  }
});

test('npm run import -- news --scope foo: одне речення і підказка, без стеку, код виходу 1', () => {
  const run = spawnSync(process.execPath, ['scripts/import/index.mjs', 'news', '--scope', 'foo'], { encoding: 'utf8' });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /^Помилка: невідомий обсяг «foo»/m);
  assert.match(run.stderr, /Як запускати:/);
  assert.doesNotMatch(run.stderr, /\bat .*\.mjs:\d+|node:internal|Node\.js v/);
  assert.equal(run.stdout, '', 'нічого не імпортувалось');
});

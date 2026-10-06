import { createTypingNotifier } from './typingNotifier';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('a long message sends only start and idle transitions', () => {
  const notify = jest.fn();
  const notifier = createTypingNotifier(notify);
  for (let i = 1; i <= 500; i++) {
    notifier.update('a'.repeat(i));
    jest.advanceTimersByTime(100);
  }
  expect(notify.mock.calls).toEqual([[true]]);
  jest.advanceTimersByTime(1200);
  expect(notify.mock.calls).toEqual([[true], [false]]);
});

test('sending or leaving stops typing and cancels the pending timer', () => {
  const notify = jest.fn();
  const notifier = createTypingNotifier(notify);
  notifier.update('hello');
  notifier.stop();
  notifier.stop();
  jest.runAllTimers();
  expect(notify.mock.calls).toEqual([[true], [false]]);
  notifier.update('next message');
  expect(notify).toHaveBeenLastCalledWith(true);
  notifier.stop();
});

test('clearing input stops typing immediately', () => {
  const notify = jest.fn();
  const notifier = createTypingNotifier(notify);
  notifier.update('hello');
  notifier.update(' ');
  jest.runAllTimers();
  expect(notify.mock.calls).toEqual([[true], [false]]);
});

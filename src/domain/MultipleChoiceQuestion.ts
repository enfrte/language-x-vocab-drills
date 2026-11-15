/**
 * MultipleChoiceQuestion — a domain value object, one question on screen.
 *
 * Owns the picking rule that used to live in the Imba `mcq` tag: the first
 * pick wins (guards against double-picks) and after that the question is
 * frozen for feedback display.
 *
 * Frontends receive an immutable QuestionView snapshot (see `toView()`) —
 * never this object — so any framework can treat it as plain props.
 */

import type { QuestionView, QuestionDirection } from './types';

export class MultipleChoiceQuestion {
  readonly direction: QuestionDirection;
  readonly prompt: string;
  readonly options: string[];
  readonly correct: string;

  private chosen: string | null = null;
  private right: boolean | null = null;

  constructor(direction: QuestionDirection, prompt: string, options: string[], correct: string) {
    this.direction = direction;
    this.prompt = prompt;
    this.options = options;
    this.correct = correct;
  }

  /** The picked option, or null before picking. */
  get picked(): string | null {
    return this.chosen;
  }

  /** True once an option has been picked and it is the correct one. */
  get wasRight(): boolean {
    return this.right ?? false;
  }

  /** Whether any pick has happened (buttons locked after this). */
  get answered(): boolean {
    return this.chosen !== null;
  }

  /**
   * Records the pick. Returns whether it was correct, or null when the
   * question was already answered.
   */
  answer(option: string): boolean | null {
    if (this.chosen !== null || !this.options.includes(option)) return null;
    this.chosen = option;
    this.right = option === this.correct;
    return this.right;
  }

  /** Immutable snapshot for renderers. */
  toView(): QuestionView {
    return {
      prompt: this.prompt,
      options: this.options,
      correct: this.correct,
      picked: this.chosen,
      wasRight: this.right ?? false,
    };
  }
}

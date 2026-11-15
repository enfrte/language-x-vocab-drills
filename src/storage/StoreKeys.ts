/**
 * StoreKeys — builds the persistence keys for one language's topic.
 *
 * The progress store is one flat key/value table; these keys are the naming
 * discipline that keeps languages and topics independent. Different key
 * shapes exist:
 *   in-progress:<language>:<topic>  — number[] ids of the active Learn batch
 *   learned:<language>:<topic>      — number[] ids of every word completed by Learn
 *   recall-index:<language>:<topic> — number, the Recall resume position
 * Settings (theme) live in localStorage with plain keys instead.
 */

export class StoreKeys {
  readonly languageCode: string;
  readonly topicId: string;

  constructor(languageCode: string, topicId: string) {
    this.languageCode = languageCode;
    this.topicId = topicId;
  }

  /** Ids of the topic's current Learn batch. */
  get learnInProgress(): string {
    return `in-progress:${this.languageCode}:${this.topicId}`;
  }

  /** Ids of everything the learner completed in Learn mode. */
  get learneds(): string {
    return `learned:${this.languageCode}:${this.topicId}`;
  }

  /** The topic's Recall resume position. */
  get recallIndex(): string {
    return `recall-index:${this.languageCode}:${this.topicId}`;
  }
}

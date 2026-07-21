export class SingleConnectionQueue {
  #current;
  #waiting;
  #run;
  #reject;

  constructor(run, reject) {
    this.#run = run;
    this.#reject = reject;
  }

  enqueue(connection) {
    if (!this.#current) {
      this.#start(connection);
      return "started";
    }
    if (this.#waiting) {
      this.#reject(connection);
      return "rejected";
    }
    this.#waiting = connection;
    return "queued";
  }

  cancel(connection) {
    if (this.#waiting !== connection) return false;
    this.#waiting = undefined;
    return true;
  }

  #start(connection) {
    this.#current = connection;
    void Promise.resolve()
      .then(() => this.#run(connection))
      .catch(() => {})
      .finally(() => {
        if (this.#current !== connection) return;
        this.#current = undefined;
        const next = this.#waiting;
        this.#waiting = undefined;
        if (next) this.#start(next);
      });
  }
}

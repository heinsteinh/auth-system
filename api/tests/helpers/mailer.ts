type Mail = {
  to: string;
  type: 'verify' | 'reset';
  token: string;
};

class MailerStub {
  private inbox: Mail[] = [];

  push(mail: Mail): void {
    this.inbox.push(mail);
  }

  reset(): void {
    this.inbox = [];
  }

  all(): readonly Mail[] {
    return this.inbox;
  }

  lastFor(email: string, type: Mail['type']): Mail | undefined {
    return [...this.inbox].reverse().find((m) => m.to === email && m.type === type);
  }
}

export const mailerStub = new MailerStub();

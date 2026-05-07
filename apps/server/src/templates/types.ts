export interface RenderedEmail {
  subject: string;
  html: string;
}

export interface ReportTemplate<TData = unknown> {
  id: string;
  description: string;
  sourceType: string;
  shouldDeliver(data: TData): boolean;
  mockData(): TData;
  renderEmail(data: TData): RenderedEmail;
  renderTelegram(data: TData): string;
}

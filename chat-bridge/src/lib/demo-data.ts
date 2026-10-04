export type DemoEvent = {
  id: string;
  summary: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
};

export type DemoEmail = {
  id: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  date: string;
  body: string;
};

const now = new Date();

function at(dayOffset: number, hour: number, minute = 0): string {
  const d = new Date(now);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export const demoEvents: DemoEvent[] = [
  {
    id: "evt-1",
    summary: "Morgonstandup",
    start: at(0, 9, 0),
    end: at(0, 9, 15),
    location: "Meet",
    description: "Kort avstämning med teamet",
  },
  {
    id: "evt-2",
    summary: "Lunch med Anna",
    start: at(0, 12, 0),
    end: at(0, 13, 0),
    location: "Café Norr",
  },
  {
    id: "evt-3",
    summary: "Kundmöte – Q2-plan",
    start: at(1, 10, 0),
    end: at(1, 11, 0),
    location: "Teams",
    description: "Gå igenom roadmap och leveranser",
  },
  {
    id: "evt-4",
    summary: "Tandläkare",
    start: at(3, 15, 30),
    end: at(3, 16, 15),
    location: "Folktandvården",
  },
];

export const demoEmails: DemoEmail[] = [
  {
    id: "mail-1",
    from: "anna@exempel.se",
    to: "jag@exempel.se",
    subject: "Lunch imorgon?",
    snippet: "Hej! Funkar det att ta lunch i eftermiddag i stället?",
    date: at(-1, 18, 22),
    body: "Hej!\n\nFunkar det att ta lunch i eftermiddag i stället? Café Norr har bord.\n\n/Anna",
  },
  {
    id: "mail-2",
    from: "faktura@bolag.se",
    to: "jag@exempel.se",
    subject: "Faktura #4821 förfaller snart",
    snippet: "Din faktura förfaller om 3 dagar. Belopp: 1 240 kr.",
    date: at(-2, 9, 5),
    body: "Hej,\n\nDin faktura #4821 förfaller om 3 dagar. Belopp: 1 240 kr.\n\nMed vänlig hälsning,\nBolag AB",
  },
  {
    id: "mail-3",
    from: "projekt@team.se",
    to: "jag@exempel.se",
    subject: "Underlag till kundmötet",
    snippet: "Här kommer slides och agenda till mötet imorgon.",
    date: at(0, 8, 10),
    body: "Hej,\n\nHär kommer slides och agenda till mötet imorgon kl 10.\n\nHälsningar,\nProjektteamet",
  },
];

export const createdDemoEvents: DemoEvent[] = [];
export const sentDemoEmails: DemoEmail[] = [];

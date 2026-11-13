export interface TeamMemberConfig {
  name: string;
  accountId?: string;
}

export interface TeamConfig {
  id: string;
  name: string;
  members: TeamMemberConfig[];
}

export const CORE_ENGINEERING: TeamConfig = {
  id: "core-engineering",
  name: "Core Engineering",
  members: [
    { name: "Faisal Achmad Dwi Cahyono", accountId: "712020:dc61cda8-2a1a-4126-ba66-2575873736ef" },
    { name: "Baby Ayu Alicya", accountId: "712020:4db10c88-d8e9-4c5c-b6c1-a50dd4c5a0ea" },
    { name: "Dirwan Permana", accountId: "712020:a7ac15f0-d1f2-4ba9-93fd-1b023e5fdd37" },
    { name: "Stevent Andrean", accountId: "712020:76ed9d73-3f42-4dc3-a7f2-a39a2987fc0d" },
    { name: "Harris Ishaq Ibrahim", accountId: "712020:79c62910-b692-4af1-90b5-205861ac2ac8" },
    { name: "Made Agustha I.S.", accountId: "712020:f96dfa44-08f6-4d93-bd07-be277ff0b607" },
    { name: "Ridho Rifqy Muhammad", accountId: "712020:5d5506d8-3b43-47b0-b176-1f5b4d78b5d2" },
    { name: "Rizki Nastiti", accountId: "5ff27f9f44065f013f920e62" },
    { name: "Reagent Sandra", accountId: "712020:3e6c4ad2-e204-4a89-91a5-7f243a2efc4a" },
    { name: "Felix Nathanael", accountId: "712020:4e21b804-18be-41e8-91a9-c7a51c51e000" },
    { name: "Cecep Abdul Rahman", accountId: "712020:0595accb-b529-469c-a8b0-b371aa708e22" },
  ],
};

export const DEFAULT_TEAMS: TeamConfig[] = [CORE_ENGINEERING];

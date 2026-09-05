import { describe, it, expect } from "vitest";
import { getAvailableActions, statoDopoAnnullamento, deveInviareEsito, type CandidaturaLike } from "@/lib/candidaturaActions";

function cand(stadio: string, extra: Partial<CandidaturaLike> = {}): CandidaturaLike {
  return { id: "c1", stadio, ...extra };
}

function ids(c: CandidaturaLike, opts = {}) {
  return getAvailableActions(c, opts).map(a => a.id);
}

describe("getAvailableActions — elimina", () => {
  it("da_decidere senza assegnazioni offre elimina", () => {
    expect(ids(cand("da_decidere"))).toContain("elimina");
  });

  it("in_attesa_posto senza assegnazioni offre elimina", () => {
    expect(ids(cand("in_attesa_posto"))).toContain("elimina");
  });

  it("in_casa non offre elimina", () => {
    expect(ids(cand("in_casa", { assegnazione_id: "a1" }))).not.toContain("elimina");
  });

  it("assegnato non offre elimina", () => {
    expect(ids(cand("assegnato", { assegnazione_id: "a1" }))).not.toContain("elimina");
  });

  it("da_decidere con haAvutoAssegnazione non offre elimina", () => {
    expect(ids(cand("da_decidere"), { haAvutoAssegnazione: true })).not.toContain("elimina");
  });
});

describe("getAvailableActions — in_attesa_studente", () => {
  it("offre assegna_camera", () => {
    expect(ids(cand("in_attesa_studente"))).toContain("assegna_camera");
  });
});

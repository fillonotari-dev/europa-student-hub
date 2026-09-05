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

describe("getAvailableActions — invia_esito escluso per inserimento manuale", () => {
  it("candidatura accolta form_pubblico offre invia_esito", () => {
    expect(ids(cand("accolta", { stato: "accolta", origine: "form_pubblico" }))).toContain("invia_esito");
  });

  it("candidatura accolta inserimento_manuale non offre invia_esito", () => {
    expect(ids(cand("accolta", { stato: "accolta", origine: "inserimento_manuale" }))).not.toContain("invia_esito");
  });

  it("candidatura rifiutata inserimento_manuale non offre invia_esito", () => {
    expect(ids(cand("rifiutata", { stato: "rifiutata", origine: "inserimento_manuale" }))).not.toContain("invia_esito");
  });
});

describe("statoDopoAnnullamento", () => {
  it("inserimento_manuale torna in lista d'attesa", () => {
    expect(statoDopoAnnullamento("inserimento_manuale")).toBe("in_attesa_posto");
  });

  it("form_pubblico torna in da_decidere", () => {
    expect(statoDopoAnnullamento("form_pubblico")).toBe("da_decidere");
  });

  it("origine undefined o null torna in da_decidere", () => {
    expect(statoDopoAnnullamento(undefined)).toBe("da_decidere");
    expect(statoDopoAnnullamento(null)).toBe("da_decidere");
  });
});

describe("deveInviareEsito", () => {
  it("assegna + form_pubblico invia l'esito", () => {
    expect(deveInviareEsito("assegna", "form_pubblico")).toBe(true);
  });

  it("assegna + inserimento_manuale non invia l'esito", () => {
    expect(deveInviareEsito("assegna", "inserimento_manuale")).toBe(false);
  });

  it("rinnova e nuovo non inviano mai l'esito", () => {
    expect(deveInviareEsito("rinnova", "form_pubblico")).toBe(false);
    expect(deveInviareEsito("nuovo", "form_pubblico")).toBe(false);
    expect(deveInviareEsito("rinnova", "inserimento_manuale")).toBe(false);
    expect(deveInviareEsito("nuovo", "inserimento_manuale")).toBe(false);
  });
});

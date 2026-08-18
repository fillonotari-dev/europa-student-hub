import { describe, it, expect } from "vitest";
import {
  statoDopoLinkGenerato,
  statoDopoCompletamento,
} from "../../supabase/functions/_shared/stato-candidatura";

describe("statoDopoLinkGenerato", () => {
  it("porta da_valutare a in_attesa_studente", () => {
    expect(statoDopoLinkGenerato("da_valutare")).toBe("in_attesa_studente");
  });

  it("non cambia stato se il link viene rigenerato su in_attesa_studente", () => {
    expect(statoDopoLinkGenerato("in_attesa_studente")).toBe("in_attesa_studente");
  });

  it("lascia in_attesa_posto invariato (lista d'attesa, non esito)", () => {
    expect(statoDopoLinkGenerato("in_attesa_posto")).toBe("in_attesa_posto");
  });
});

describe("statoDopoCompletamento", () => {
  it("porta in_attesa_studente a da_decidere", () => {
    expect(statoDopoCompletamento("in_attesa_studente")).toBe("da_decidere");
  });

  it("porta da_valutare a da_decidere", () => {
    expect(statoDopoCompletamento("da_valutare")).toBe("da_decidere");
  });

  it("non retrocede una candidatura accolta", () => {
    expect(statoDopoCompletamento("accolta")).toBe("accolta");
  });

  it("non retrocede una candidatura in_attesa_posto", () => {
    expect(statoDopoCompletamento("in_attesa_posto")).toBe("in_attesa_posto");
  });
});

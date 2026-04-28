export type CourseLevel = 'ciclo_unico' | 'triennale' | 'magistrale' | 'professione_sanitaria';

export type Course = { name: string; level: CourseLevel };
export type Department = { id: string; name: string; sede: string; courses: Course[] };
export type University = { id: string; name: string; departments: Department[] };

const t = (names: string[]): Course[] => names.map(name => ({ name, level: 'triennale' }));
const m = (names: string[]): Course[] => names.map(name => ({ name, level: 'magistrale' }));
const cu = (names: string[]): Course[] => names.map(name => ({ name, level: 'ciclo_unico' }));
const ps = (names: string[]): Course[] => names.map(name => ({ name, level: 'professione_sanitaria' }));

export const UNIVERSITIES: University[] = [
  {
    id: 'unimore',
    name: 'Università di Modena e Reggio Emilia (UNIMORE)',
    departments: [
      {
        id: 'economia-marco-biagi',
        name: 'Dipartimento di Economia "Marco Biagi"',
        sede: 'Modena',
        courses: [
          ...t(['Economia Aziendale e Management', 'Economia e Finanza', 'Economia e Marketing Internazionale']),
          ...m(['Analisi dei Dati per l\'Economia e il Management', 'Analisi, Consulenza e Gestione Finanziaria', 'Direzione e Consulenza d\'Impresa', 'Economia, Politiche Pubbliche e Sostenibilità', 'International Management', 'Relazioni di Lavoro']),
        ],
      },
      {
        id: 'comunicazione-economia',
        name: 'Dipartimento di Comunicazione ed Economia',
        sede: 'Reggio Emilia',
        courses: [
          ...t(['Analisi dei Dati per l\'Impresa e la Finanza', 'Digital Marketing', 'Marketing e Organizzazione d\'Impresa', 'Scienze della Comunicazione']),
          ...m(['Management e Comunicazione d\'Impresa', 'Pubblicità, Comunicazione Digitale e Creatività d\'Impresa', 'Economia e Diritto per la Sostenibilità delle Organizzazioni (Interdipartimentale)']),
        ],
      },
      {
        id: 'giurisprudenza',
        name: 'Dipartimento di Giurisprudenza',
        sede: 'Modena',
        courses: [
          ...cu(['Giurisprudenza']),
          ...t(['Scienze Giuridiche dell\'Impresa e della Pubblica Amministrazione']),
        ],
      },
      {
        id: 'educazione-scienze-umane',
        name: 'Dipartimento di Educazione e Scienze Umane',
        sede: 'Reggio Emilia',
        courses: [
          ...cu(['Scienze della Formazione Primaria']),
          ...t(['Scienze dell\'Educazione per il Nido e le Professioni Socio-Pedagogiche', 'Scienze e Tecniche Psicologiche', 'Digital Education (L-19 interclasse)']),
          ...m(['Scienze Pedagogiche', 'Teorie e Metodologie del Digital Learning']),
        ],
      },
      {
        id: 'studi-linguistici-culturali',
        name: 'Dipartimento di Studi Linguistici e Culturali',
        sede: 'Modena',
        courses: [
          ...t(['Lingue e Culture Europee', 'Storia e Culture Contemporanee']),
          ...m(['Antropologia e Storia del Mondo Contemporaneo', 'Lingue per la Comunicazione nell\'Impresa e nelle Organizzazioni', 'Filosofia (Interateneo)']),
        ],
      },
      {
        id: 'medicina-chirurgia',
        name: 'Facoltà di Medicina e Chirurgia',
        sede: 'Modena/Reggio Emilia',
        courses: [
          ...cu(['Medicina e Chirurgia', 'Odontoiatria e Protesi Dentaria']),
          ...ps(['Infermieristica', 'Ostetricia', 'Fisioterapia', 'Logopedia', 'Tecnica della Riabilitazione Psichiatrica', 'Terapia Occupazionale', 'Igiene Dentale', 'Dietistica', 'Tecniche di Laboratorio Biomedico', 'Tecniche di Radiologia Medica per Immagini e Radioterapia']),
          ...t(['Scienze Motorie']),
          ...m(['Scienze Infermieristiche ed Ostetriche', 'Salute e Sport', 'Bioingegneria per l\'Innovazione in Medicina']),
        ],
      },
      {
        id: 'scienze-vita',
        name: 'Dipartimento di Scienze della Vita',
        sede: 'Modena/Reggio Emilia',
        courses: [
          ...cu(['Farmacia', 'Chimica e Tecnologia Farmaceutiche (CTF)']),
          ...t(['Biotecnologie', 'Scienze Biologiche', 'Scienze e Tecnologie Agrarie e degli Alimenti']),
          ...m(['Bioscienze', 'Biotecnologie Mediche', 'Controllo e Sicurezza degli Alimenti', 'Sostenibilità Integrata dei Sistemi Agricoli']),
        ],
      },
      {
        id: 'scienze-chimiche-geologiche',
        name: 'Dipartimento di Scienze Chimiche e Geologiche',
        sede: 'Modena',
        courses: [
          ...t(['Chimica', 'Scienze Geologiche', 'Scienze Naturali']),
          ...m(['Scienze Chimiche', 'Scienze Geologiche', 'Geofisica (Interateneo)']),
        ],
      },
      {
        id: 'scienze-fisiche-informatiche-matematiche',
        name: 'Dipartimento di Scienze Fisiche, Informatiche e Matematiche',
        sede: 'Modena',
        courses: [
          ...t(['Fisica', 'Informatica', 'Matematica']),
          ...m(['Fisica', 'Informatica', 'Matematica']),
        ],
      },
      {
        id: 'ingegneria-enzo-ferrari',
        name: 'Dipartimento di Ingegneria "Enzo Ferrari"',
        sede: 'Modena',
        courses: [
          ...t(['Ingegneria Civile e Ambientale', 'Ingegneria Elettronica', 'Ingegneria Informatica', 'Ingegneria Meccanica', 'Ingegneria del Veicolo']),
          ...m(['Ingegneria Civile', 'Ingegneria dei Materiali', 'Ingegneria Elettronica', 'Ingegneria Informatica', 'Ingegneria Meccanica', 'Ingegneria del Veicolo', 'Advanced Automotive Engineering (Internazionale)']),
        ],
      },
      {
        id: 'scienze-metodi-ingegneria',
        name: 'Dipartimento di Scienze e Metodi dell\'Ingegneria',
        sede: 'Reggio Emilia',
        courses: [
          ...t(['Ingegneria Gestionale', 'Ingegneria Meccatronica']),
          ...m(['Ingegneria Gestionale', 'Ingegneria Meccatronica']),
        ],
      },
    ],
  },
];

export const COURSE_LEVEL_LABELS: Record<CourseLevel, { it: string; en: string }> = {
  ciclo_unico: { it: 'Ciclo Unico', en: 'Single-cycle' },
  triennale: { it: 'Triennali', en: 'Bachelor\'s' },
  magistrale: { it: 'Magistrali', en: 'Master\'s' },
  professione_sanitaria: { it: 'Professioni Sanitarie', en: 'Health Professions' },
};

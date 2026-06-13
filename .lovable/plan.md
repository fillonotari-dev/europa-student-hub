# Recupero password admin

Aggiungo il flusso completo di reset password per gli amministratori, usando le email di auth di Lovable Cloud.

## 1. Pagina Login (`src/pages/Login.tsx`)

- Aggiungo link "Password dimenticata?" sotto il form.
- Cliccandolo si apre un piccolo form (stessa pagina, toggle di stato) che chiede solo l'email.
- Submit chiama:
  ```ts
  supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`
  })
  ```
- Mostra toast di conferma ("Se l'email è registrata, riceverai un link").

## 2. Nuova pagina `/reset-password` (`src/pages/ResetPassword.tsx`)

- Rotta pubblica registrata in `src/App.tsx`.
- Listener `onAuthStateChange` per evento `PASSWORD_RECOVERY` (Supabase imposta automaticamente la sessione di recupero dall'hash URL).
- Form con due campi: nuova password + conferma. Validazione minima (min 8 caratteri, match).
- Submit chiama `supabase.auth.updateUser({ password })`.
- Al successo: toast + redirect a `/login`.
- Stile coerente con la Login attuale (logo, layout centrato).

## 3. Email template (opzionale ma consigliato)

L'invio funziona già con il template di default di Lovable Cloud (mittente generico). 
**Domanda:** vuoi anche personalizzare il template email (mittente dal tuo dominio + branding Studentato Europa)? Questo richiede di configurare un dominio email e fare scaffold dei template auth. Se sì, lo includo; se no, lascio i default e l'email arriva comunque. 

RISPOSTA: per ora manteniamo default

## Note tecniche

- Nessuna modifica DB / edge functions.
- Nessuna modifica al form pubblico di candidatura.
- Login resta riservato agli admin (verifica `user_roles` già presente in `AdminLayout`).

## File toccati

- `src/pages/Login.tsx` (aggiunta link + mini-form)
- `src/pages/ResetPassword.tsx` (nuovo)
- `src/App.tsx` (nuova rotta)
/* Sincronização opcional entre navegadores (Polo 1740)
   -----------------------------------------------------
   Sem configuração (padrão), o painel funciona exatamente como antes: cada navegador guarda seu
   próprio rascunho em localStorage, e "publicar" é baixar o data.js e trocar o arquivo no GitHub.

   Com um projeto Firebase gratuito configurado em sync-config.js, este arquivo passa a manter os
   dados num banco compartilhado: a alteração que uma pessoa da equipe faz aparece para as outras
   em poucos segundos, em qualquer navegador, sem precisar baixar/subir arquivo nenhum. Como o
   banco passa a ser compartilhado, cada pessoa precisa de um login (e-mail + senha) próprio,
   criado pela coordenação no Firebase — veja o passo a passo no README ("Sincronizar entre
   navegadores" e "Login de cada pessoa da equipe").
*/
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Sync = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const CONFIG = (typeof window !== 'undefined' && window.FIREBASE_CONFIG) || null;
  const FIREBASE_VERSION = '10.14.1';
  let docRef = null;
  let carregando = null;

  function configured() { return !!CONFIG; }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      const s = document.createElement('script');
      s.src = src; s.onload = function () { resolve(); }; s.onerror = function () { reject(new Error('Falha ao carregar ' + src)); };
      document.head.appendChild(s);
    });
  }

  function garantirFirebase() {
    if (carregando) return carregando;
    carregando = Promise.resolve()
      .then(function () { return (typeof firebase === 'undefined') ? loadScript('https://www.gstatic.com/firebasejs/' + FIREBASE_VERSION + '/firebase-app-compat.js') : null; })
      .then(function () { return (typeof firebase === 'undefined' || !firebase.firestore) ? loadScript('https://www.gstatic.com/firebasejs/' + FIREBASE_VERSION + '/firebase-firestore-compat.js') : null; })
      .then(function () { return (typeof firebase === 'undefined' || !firebase.auth) ? loadScript('https://www.gstatic.com/firebasejs/' + FIREBASE_VERSION + '/firebase-auth-compat.js') : null; })
      .then(function () { if (!firebase.apps.length) firebase.initializeApp(CONFIG); });
    return carregando;
  }

  /**
   * Liga a sincronização. `onRemoto(dados)` é chamado sempre que outro navegador salvar uma
   * mudança (dados = objeto com as mesmas chaves usadas em `push`). `onStatus(status)` é chamado
   * com 'sem-config' | 'conectando' | 'sincronizado' | 'erro'. `estadoAtual()` deve devolver o
   * estado local (usado só uma vez, para semear o banco se ele ainda estiver vazio).
   * Chame só depois que a pessoa já estiver autenticada (veja `watchAuth`) — as regras do
   * Firestore bloqueiam quem não tiver feito login.
   */
  function init(onRemoto, onStatus, estadoAtual) {
    if (!CONFIG) { onStatus && onStatus('sem-config'); return; }
    onStatus && onStatus('conectando');
    garantirFirebase().then(function () {
      const db = firebase.firestore();
      docRef = db.collection('washington').doc('estado');
      let primeira = true;
      docRef.onSnapshot(function (snap) {
        onStatus && onStatus('sincronizado');
        if (snap.exists) {
          onRemoto(snap.data() || {});
        } else if (primeira && estadoAtual) {
          // Banco novo/vazio: semeia com o que já existe neste navegador.
          docRef.set(Object.assign({}, estadoAtual(), { atualizadoEm: new Date().toISOString() })).catch(function () { /* tenta de novo na próxima alteração */ });
        }
        primeira = false;
      }, function () {
        onStatus && onStatus('erro');
      });
    }).catch(function () {
      onStatus && onStatus('erro');
    });
  }

  /** Envia só os campos alterados (mesclados no documento compartilhado). */
  function push(parcial) {
    if (!CONFIG || !docRef) return Promise.resolve(false);
    const corpo = Object.assign({}, parcial, { atualizadoEm: new Date().toISOString() });
    return docRef.set(corpo, { merge: true }).then(function () { return true; }, function () { return false; });
  }

  /* ---------- Login (Firebase Authentication, e-mail/senha) ---------- */

  /**
   * Observa o estado de login. `cb(user)` é chamado agora e de novo sempre que a pessoa entrar
   * ou saír — `user` é o objeto do Firebase (tem `.email`) quando logada, ou `null` quando não.
   * Sem configuração, chama `cb(null)` uma vez (o painel trata isso como "não precisa de login").
   */
  function watchAuth(cb) {
    if (!CONFIG) { cb(null); return; }
    garantirFirebase().then(function () {
      firebase.auth().onAuthStateChanged(function (user) { cb(user); }, function () { cb(null); });
    }).catch(function () { cb(null); });
  }

  function signIn(email, senha) {
    if (!CONFIG) return Promise.reject(new Error('Sincronização não configurada.'));
    return garantirFirebase().then(function () { return firebase.auth().signInWithEmailAndPassword(email, senha); });
  }

  function signOut() {
    if (!CONFIG) return Promise.resolve();
    return garantirFirebase().then(function () { return firebase.auth().signOut(); });
  }

  /** Traduz os erros mais comuns do Firebase Auth para uma frase que a equipe entenda. */
  function mensagemErroLogin(err) {
    const codigo = err && err.code;
    const MAPA = {
      'auth/invalid-email': 'E-mail inválido.',
      'auth/missing-password': 'Digite a senha.',
      'auth/user-not-found': 'Não existe usuário com esse e-mail. Peça pra coordenação cadastrar o seu acesso.',
      'auth/wrong-password': 'Senha incorreta.',
      'auth/invalid-credential': 'E-mail ou senha incorretos.',
      'auth/too-many-requests': 'Muitas tentativas erradas. Aguarde um pouco e tente de novo.',
      'auth/user-disabled': 'Este acesso foi desativado. Fale com a coordenação.',
      'auth/network-request-failed': 'Sem conexão com a internet agora.',
      'auth/operation-not-allowed': 'O login por e-mail/senha ainda não foi ativado no Firebase (veja o README).',
    };
    return MAPA[codigo] || 'Não foi possível entrar. Confira o e-mail e a senha.';
  }

  return {
    configured: configured, init: init, push: push,
    watchAuth: watchAuth, signIn: signIn, signOut: signOut, mensagemErroLogin: mensagemErroLogin,
  };
});

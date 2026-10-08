/* Painel acadêmico · Washington Ilha — interface */
(function () {
  'use strict';
  const L = window.L;
  const DATA = window.WASH_DATA || { professores: [], turmas: [], alunos: [] };
  const $ = function (s, el) { return (el || document).querySelector(s); };
  const $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  const esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  /* ---------- Armazenamento local (por navegador) + sincronização opcional entre navegadores ---------- */
  const Sync = window.Sync || { configured: function () { return false; }, init: function () {}, push: function () { return Promise.resolve(false); } };
  const CHAVES_SYNC = ['professores', 'turmas', 'alunos', 'matriculas', 'compromissos', 'frequencias', 'cfg', 'log', 'asaasImportado', 'materiais', 'entradas', 'despesas', 'pendencias', 'comunicados'];
  const LS = {
    get: function (k, def) { try { const v = localStorage.getItem('washington.' + k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
    set: function (k, v) {
      try { localStorage.setItem('washington.' + k, JSON.stringify(v)); } catch (e) { /* ignora */ }
      if (CHAVES_SYNC.indexOf(k) >= 0 && Sync.configured()) { const p = {}; p[k] = v; Sync.push(p); }
      return true;
    },
    setLocal: function (k, v) { try { localStorage.setItem('washington.' + k, JSON.stringify(v)); } catch (e) { /* ignora */ } },
    del: function (k) { try { localStorage.removeItem('washington.' + k); } catch (e) { /* ignora */ } }
  };

  const alunosSalvos = LS.get('alunos', null);
  const S = {
    professores: LS.get('professores', null) || (DATA.professores || []).map(function (p) { return Object.assign({}, p); }),
    turmas: LS.get('turmas', null) || (DATA.turmas || []).map(function (t) { return Object.assign({}, t); }),
    alunos: alunosSalvos || (DATA.alunos || []).map(function (a) {
      return Object.assign({ formaPagamento: 'desconhecido', email: '', bolsista: false, cancelado: false, dataInicio: '', responsavelFinanceiro: '' }, a, {
        pagamento: Object.assign({ valorEmAberto: '' }, a.pagamento), frequencia: Object.assign({}, a.frequencia),
        materialDidatico: Object.assign({}, a.materialDidatico), rematricula: Object.assign({}, a.rematricula),
        livroDidatico: Object.assign({ qual: '', comprado: false, mensagemEnviada: false }, a.livroDidatico),
        cobranca: Object.assign({ etapa: 0, enviadoEm: '' }, a.cobranca),
        cancelamento: Object.assign({ solicitado: false, data: '', motivo: '' }, a.cancelamento),
      });
    }),
    matriculas: LS.get('matriculas', []),
    compromissos: LS.get('compromissos', []),
    frequencias: LS.get('frequencias', []),
    cfg: Object.assign({ autor: '' }, LS.get('cfg', {})),
    log: LS.get('log', []),
    asaasImportado: LS.get('asaasImportado', null),
    materiais: LS.get('materiais', []),
    entradas: LS.get('entradas', []),
    despesas: LS.get('despesas', []),
    pendencias: LS.get('pendencias', []),
    comunicados: LS.get('comunicados', []),
  };

  /* ---------- Garante que alunos já salvos (ou sincronizados de outro navegador) antes destes
     campos existirem não quebrem o painel. Importante: isso tem que rodar não só na carga inicial,
     mas TODA VEZ que dados de alunos chegarem pela sincronização entre navegadores também — senão,
     o cadastro de um aluno sincronizado de um aparelho que ainda não tinha essas abas quebra a
     tela ao abrir ("Abrir" parece não fazer nada). ---------- */
  function normalizarAlunos(lista) {
    (lista || []).forEach(function (a) {
      if (a.dataInicio == null) a.dataInicio = '';
      if (!a.cancelamento) a.cancelamento = { solicitado: false, data: '', motivo: '' };
      else {
        if (a.cancelamento.solicitado == null) a.cancelamento.solicitado = false;
        if (a.cancelamento.data == null) a.cancelamento.data = '';
        if (a.cancelamento.motivo == null) a.cancelamento.motivo = '';
      }
      if (!a.livroDidatico) a.livroDidatico = { qual: '', comprado: false, mensagemEnviada: false };
      else if (a.livroDidatico.comprado == null) a.livroDidatico.comprado = false;
      if (a.bolsista == null) a.bolsista = false;
      if (a.cancelado == null) a.cancelado = false;
      if (a.email == null) a.email = '';
      if (a.responsavelFinanceiro == null) a.responsavelFinanceiro = '';
    });
    return lista;
  }
  normalizarAlunos(S.alunos);

  /* ---------- Migração: traz dados novos (ex.: telefone/e-mail importados) sem apagar edições manuais ---------- */
  (function migrarDadosPadrao() {
    const versaoNova = DATA.versaoDados || 0;
    const versaoSalva = LS.get('versaoDados', 0);
    if (!alunosSalvos || versaoSalva >= versaoNova) { LS.set('versaoDados', versaoNova); return; }
    const porId = {};
    (DATA.alunos || []).forEach(function (a) { porId[a.id] = a; });
    let atualizados = 0;
    S.alunos.forEach(function (a) {
      const novo = porId[a.id];
      if (!novo) return;
      if (!a.telefone && novo.telefone) { a.telefone = novo.telefone; atualizados++; }
      if (!a.email && novo.email) { a.email = novo.email; atualizados++; }
    });
    if (atualizados) LS.setLocal('alunos', S.alunos);
    LS.set('versaoDados', versaoNova);
  })();
  const params = new URLSearchParams(location.search);
  const HOJE = /^\d{4}-\d{2}-\d{2}$/.test(params.get('hoje') || '') ? params.get('hoje') : new Date().toISOString().slice(0, 10);
  // Minutos desde meia-noite agora — usado pra saber quais turmas do dia já aconteceram. Aceita
  // "?agora=HH:MM" (igual ao "?hoje=") só pra dar pra testar de forma previsível; no uso real
  // (sem o parâmetro) usa o horário de verdade do relógio.
  const AGORA_MIN = (function () {
    const m = /^(\d{1,2}):(\d{2})$/.exec(params.get('agora') || '');
    if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  })();
  const V = {
    view: 'semana', semestre: L.semestreDeData(HOJE), fProf: '', fSit: '', buscaTurma: '', buscaAluno: '', buscaAlunoCancelado: '', fPag: '', syncStatus: 'sem-config',
    semanaOffset: 0, semanaModo: 'semana', diaOffsetDias: 0,
    novaMatricula: {
      alunoId: '', alunoNome: '', turmaId: '', dataInicio: '', dataPagamento: '', formaPagamento: 'asaas',
      valorMensalidade: '', valorMaterial: '', livro: '', descontoTem: false, descontoValor: '', descontoObs: '',
    },
    novoCompromisso: { titulo: '', alunoId: '', alunoNome: '', comQuem: 'Isa', data: '', horario: '', local: '', obs: '' },
    chamadaTurmaId: '', chamadaData: HOJE, chamadaPresencas: {},
    novoMaterial: { alunoId: '', alunoNome: '', turmaNome: '', semestre: L.semestreDeData(HOJE), pagoWashington: false, recebidoEm: '', dataEnvio: '', dataEntrega: '', entregue: false, obs: '' },
    novaEntrada: { data: HOJE, alunoId: '', alunoNome: '', valor: '', formaPagamento: 'Pix', referente: '', obs: '' },
    novaDespesa: { data: HOJE, descricao: '', categoria: 'Custos Fixos', valor: '', pagoPor: '', pago: false, obs: '' },
    fMesEntradas: '', fMesDespesas: '',
    novaPendencia: { texto: '', alunoId: '', turmaId: '', prazo: '' }, fPendencia: 'abertas',
    novoComunicado: { mensagem: '', turmaId: '' },
    semProfsOcultos: {},
    logado: !Sync.configured(), authEmail: '', loginEmail: '', loginSenha: '', loginErro: '', loginCarregando: false,
  };
  const D = {};

  function proxId(prefixo, lista) {
    let max = 0;
    lista.forEach(function (x) { const m = /_(\d+)$/.exec(x.id || ''); if (m) max = Math.max(max, Number(m[1])); });
    return prefixo + '_' + (max + 1);
  }

  function recalc() {
    D.turmaPorId = {}; S.turmas.forEach(function (t) { D.turmaPorId[t.id] = t; });
    D.alunoPorId = {}; S.alunos.forEach(function (a) { D.alunoPorId[a.id] = a; });
    D.matriculaPorId = {}; S.matriculas.forEach(function (m) { D.matriculaPorId[m.id] = m; });
    D.compromissoPorId = {}; S.compromissos.forEach(function (c) { D.compromissoPorId[c.id] = c; });
    D.chamadaPorChave = {}; S.frequencias.forEach(function (c) { D.chamadaPorChave[c.turmaId + '|' + c.data] = c; });
    D.conflitos = L.conferirConflitos(S.turmas);
    D.semestres = Array.from(new Set(S.turmas.map(function (t) { return t.semestre; }))).sort();
  }
  function persistir() { LS.set('turmas', S.turmas); recalc(); }

  function autorAtual() {
    if (!S.cfg.autor) {
      const n = (typeof prompt === 'function') ? prompt('Como você se chama? (aparece no registro de alterações do painel)') : '';
      if (n && n.trim()) { S.cfg.autor = n.trim(); LS.set('cfg', S.cfg); }
    }
    return S.cfg.autor || 'Alguém';
  }
  function registrar(acao, detalhe) {
    S.log = S.log || [];
    S.log.unshift({ ts: new Date().toISOString(), autor: autorAtual(), acao: acao, detalhe: detalhe || '' });
    if (S.log.length > 200) S.log.length = 200;
    LS.set('log', S.log);
  }
  function relTempo(iso) {
    if (!iso) return '';
    const d = new Date(iso), min = Math.round((Date.now() - d.getTime()) / 60000);
    if (min < 1) return 'agora';
    if (min < 60) return 'há ' + min + ' min';
    const h = Math.round(min / 60);
    if (h < 24) return 'há ' + h + 'h';
    const dias = Math.round(h / 24);
    if (dias === 1) return 'ontem';
    return 'há ' + dias + ' dias';
  }

  /* ---------- Utilidades de interface ---------- */
  const ICON = {
    semana: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
    turmas: '<path d="M3 7l9-4 9 4-9 4-9-4Z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/>',
    professores: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-3.5 3-5.5 6.5-5.5s6 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2 .6 3.3 2.3 3.5 5.2"/>',
    alunos: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
    matriculas: '<path d="M8 3h8l4 4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M16 3v4h4"/><path d="m8.5 13 2 2 4-4.5"/>',
    compromissos: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/><path d="M8 14h2M8 17h2M14 14h2"/>',
    frequencia: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    inadimplencia: '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    material: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/><path d="M9 7h8M9 11h5"/>',
    entradas: '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/><path d="M4 4l3 3M20 4l-3 3"/>',
    despesas: '<path d="M12 2v20M17 19H9.5a3.5 3.5 0 0 1 0-7h5a3.5 3.5 0 0 0 0-7H6"/>',
    pendencias: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/><path d="m8.5 19 1.5 1.5L12 18"/>',
    comunicados: '<path d="M3 11v2a2 2 0 0 0 2 2h1l3 4v-4h8a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z"/>',
    conferencia: '<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17v.5"/>',
    buscar: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    dados: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    email: '<rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><path d="m3.5 6 7.3 5.7a1.8 1.8 0 0 0 2.4 0L20.5 6"/>',
    cadeado: '<rect x="4.5" y="10.5" width="15" height="10" rx="2.2"/><path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5"/>',
    cancelados: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/><path d="m8.5 17.5 7 4M15.5 17.5l-7 4"/>'
  };
  const VIEWS = [
    { id: 'semana', nome: 'Semana' }, { id: 'pendencias', nome: 'Pendências' }, { id: 'turmas', nome: 'Turmas' }, { id: 'matriculas', nome: 'Matrículas' },
    { id: 'compromissos', nome: 'Compromissos' }, { id: 'frequencia', nome: 'Frequência' }, { id: 'inadimplencia', nome: 'Inadimplência' },
    { id: 'material', nome: 'Material' }, { id: 'entradas', nome: 'Entradas' }, { id: 'despesas', nome: 'Despesas' },
    { id: 'alunos', nome: 'Alunos' }, { id: 'cancelados', nome: 'Cancelados' }, { id: 'comunicados', nome: 'Comunicados' },
    { id: 'professores', nome: 'Professores' }, { id: 'conferencia', nome: 'Conferência' },
    { id: 'buscar', nome: 'Buscar' }, { id: 'dados', nome: 'Dados' }
  ];
  function svg(id) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[id] + '</svg>'; }

  let toastT;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('on'); }, 3200); }
  function baixar(nome, conteudo, mime) {
    const blob = new Blob([conteudo], { type: mime || 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nome; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  function copiar(texto) {
    const fallback = function () { const t = document.createElement('textarea'); t.value = texto; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); toast('Copiado'); } catch (e) { toast('Não consegui copiar.'); } t.remove(); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto).then(function () { toast('Copiado'); }, fallback); else fallback();
  }
  function abrirDlg(html) { const d = $('#dlg'); d.innerHTML = html; if (!d.open) { if (d.showModal) d.showModal(); else d.setAttribute('open', ''); } }
  function fecharDlg() { const d = $('#dlg'); if (d.open) { if (d.close) d.close(); else d.removeAttribute('open'); } }

  /* ---------- Google Calendar "adicionar" (link direto, sem OAuth, sem sincronização de via dupla) ---------- */
  function linkGoogleCalendar(turma) {
    const hm = L.horarioMin(turma.horario);
    const dias = L.diasDaTurma(turma.dia);
    if (!hm || !dias.length) return '';
    const prox = L.proximaData(dias[0]);
    if (!prox) return '';
    function fmt(d, min) {
      const dt = new Date(d); dt.setHours(Math.floor(min / 60), min % 60, 0, 0);
      return dt.getUTCFullYear() + String(dt.getUTCMonth() + 1).padStart(2, '0') + String(dt.getUTCDate()).padStart(2, '0') + 'T' +
        String(dt.getUTCHours()).padStart(2, '0') + String(dt.getUTCMinutes()).padStart(2, '0') + '00Z';
    }
    const RRULE_DIA = { SEG: 'MO', TER: 'TU', QUA: 'WE', QUI: 'TH', SEX: 'FR', 'SÁB': 'SA', DOM: 'SU' };
    const byday = dias.map(function (d) { return RRULE_DIA[d]; }).filter(Boolean).join(',');
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: turma.turma + ' — ' + turma.professor,
      dates: fmt(prox, hm[0]) + '/' + fmt(prox, hm[1]),
      details: 'Turma ' + turma.turma + (turma.sala ? (' · Sala ' + turma.sala) : '') + ' · Professor(a) ' + turma.professor,
      location: turma.sala || '',
      recur: 'RRULE:FREQ=WEEKLY;BYDAY=' + byday,
    });
    return 'https://calendar.google.com/calendar/render?' + params.toString();
  }

  /* ---------- Navegação ---------- */
  // Como render() reconstrói o HTML inteiro da tela a cada tecla digitada (campos de busca/filtro chamam
  // render() no evento 'input'/'change' para atualizar a lista na hora), o campo que estava com foco perderia
  // o foco e o cursor a cada letra digitada — dando a sensação de "trava" ao digitar ou ao escolher algo numa
  // lista. Por isso guardamos qual campo estava focado (e a posição do cursor) antes de redesenhar, e
  // devolvemos o foco pro campo equivalente depois.
  function capturarFoco(container) {
    const el = document.activeElement;
    if (!el || !container.contains(el) || !el.dataset) return null;
    return {
      act: el.dataset.act || '', id: el.dataset.id || '', campo: el.dataset.campo || '',
      selStart: (typeof el.selectionStart === 'number') ? el.selectionStart : null,
      selEnd: (typeof el.selectionEnd === 'number') ? el.selectionEnd : null,
    };
  }
  function restaurarFoco(container, foco) {
    if (!foco || !foco.act) return false;
    let sel = '[data-act="' + foco.act + '"]';
    if (foco.id) sel += '[data-id="' + foco.id + '"]';
    if (foco.campo) sel += '[data-campo="' + foco.campo + '"]';
    let novo;
    try { novo = container.querySelector(sel); } catch (e) { novo = null; }
    if (!novo) return false;
    // Não refoca <select>: em alguns navegadores (principalmente no celular/tablet), chamar
    // .focus() de novo bem na hora em que a lista acabou de fechar faz ela reabrir sozinha,
    // dando a sensação de o botão/lista "travar". Como a escolha já foi feita, não tem cursor
    // ou posição de digitação para preservar aqui.
    if (novo.tagName === 'SELECT') return false;
    novo.focus();
    if (foco.selStart != null && novo.setSelectionRange) { try { novo.setSelectionRange(foco.selStart, foco.selEnd); } catch (e) { /* ignora */ } }
    return true;
  }
  /* ---------- Login (quando a sincronização por Firebase está configurada) ---------- */
  function viewLogin() {
    return '<div class="login-caixa">' +
      '<div class="login-fundo" aria-hidden="true"><span class="login-mancha login-mancha-1"></span><span class="login-mancha login-mancha-2"></span></div>' +
      '<form class="login-cartao">' +
      '<div class="login-selo">WI</div>' +
      '<div class="marca-login"><b>Washington Ilha</b><span>Painel acadêmico</span></div>' +
      '<h1>Entrar</h1>' +
      '<p class="login-sub">Acesse com o e-mail e a senha cadastrados pela coordenação.</p>' +
      (V.loginErro ? ('<p class="login-erro">' + esc(V.loginErro) + '</p>') : '') +
      '<div class="campo campo-icone"><label>E-mail</label><div class="campo-icone-caixa">' + svg('email') + '<input type="email" data-act="login-email" value="' + esc(V.loginEmail) + '" placeholder="seuemail@exemplo.com" autocomplete="username"></div></div>' +
      '<div class="campo campo-icone"><label>Senha</label><div class="campo-icone-caixa">' + svg('cadeado') + '<input type="password" data-act="login-senha" value="' + esc(V.loginSenha) + '" placeholder="Senha" autocomplete="current-password"></div></div>' +
      '<button class="btn on login-botao" type="submit" data-act="fazer-login"' + (V.loginCarregando ? ' disabled' : '') + '>' + (V.loginCarregando ? 'Entrando…' : 'Entrar') + '</button>' +
      '<p class="muted login-aviso">Não tem acesso ainda? Peça para a coordenação cadastrar seu e-mail no sistema.</p>' +
      '</form>' +
      '</div>';
  }

  function render() {
    const nav = $('#nav');
    if (Sync.configured() && !V.logado) {
      document.body.classList.add('tela-login');
      nav.innerHTML = '';
      const app = $('#app');
      app.innerHTML = viewLogin();
      app.focus();
      return;
    }
    document.body.classList.remove('tela-login');
    nav.innerHTML = VIEWS.map(function (v) {
      return '<button class="nav-item' + (V.view === v.id ? ' on' : '') + '" data-view="' + v.id + '">' + svg(v.id) + '<span>' + esc(v.nome) + '</span></button>';
    }).join('');
    const app = $('#app');
    const foco = capturarFoco(app);
    app.innerHTML = ({
      semana: viewSemana, pendencias: viewPendencias, turmas: viewTurmas, matriculas: viewMatriculas, compromissos: viewCompromissos,
      frequencia: viewFrequencia, inadimplencia: viewInadimplencia, material: viewMaterial, entradas: viewEntradas, despesas: viewDespesas,
      alunos: viewAlunos, cancelados: viewCancelados, comunicados: viewComunicados, professores: viewProfessores,
      conferencia: viewConferencia, buscar: viewBuscar, dados: viewDados
    }[V.view] || viewSemana)();
    if (!restaurarFoco(app, foco)) app.focus();
  }

  function sitBadge(sit) {
    const s = String(sit || '').toLowerCase();
    let cls = 'tag';
    if (/andamento/.test(s)) cls += ' tag-ok';
    else if (/formaç|confirmar/.test(s)) cls += ' tag-aviso';
    else if (/finaliz|concluid/.test(s)) cls += ' tag-neutro';
    else if (/não formou|nao formou/.test(s)) cls += ' tag-erro';
    return '<span class="' + cls + '">' + esc(sit || '—') + '</span>';
  }

  function cardTurma(t, opts) {
    opts = opts || {};
    const nAlunos = (t.alunosNomes || []).length;
    return '<div class="card-turma" data-turma="' + t.id + '">' +
      '<div class="ct-topo"><b>' + esc(t.turma) + '</b>' + sitBadge(t.situacao) + (t.encerraProxSemestre ? '<span class="tag tag-aviso">Encerra próx. semestre</span>' : '') + '</div>' +
      '<div class="ct-linha">' + esc(t.dia) + ' · ' + esc(t.horario) + (t.sala ? (' · ' + esc(t.sala)) : '') + '</div>' +
      '<div class="ct-linha">Professor(a): ' + esc(t.professor || '—') + '</div>' +
      '<div class="ct-linha muted">' + nAlunos + ' aluno(s) nesta turma · ' + esc(t.semestre) + '</div>' +
      (opts.acoes !== false ? ('<div class="ct-acoes">' +
        '<button class="btn sm" type="button" data-act="ver-turma" data-id="' + t.id + '">Ver alunos</button>' +
        '<button class="btn sm" type="button" data-act="editar-turma" data-id="' + t.id + '">Editar</button>' +
        '<button class="btn sm" type="button" data-act="baixar-ics" data-id="' + t.id + '">Baixar .ics</button>' +
        (linkGoogleCalendar(t) ? ('<a class="btn sm" target="_blank" rel="noopener" href="' + linkGoogleCalendar(t) + '">Adicionar ao Google Agenda</a>') : '') +
        '</div>') : '') +
      '</div>';
  }

  /* ---------- Semana (calendário com datas reais) ---------- */
  /* Paleta cíclica para colorir cada professor(a) na grade da semana — ajuda a enxergar de longe
     quem está em qual horário, sem precisar ler o nome em cada card. */
  const PROF_CORES = ['#1565c0', '#9c4221', '#1b7a46', '#8a3ba0', '#b7791f', '#0e7490', '#b42318', '#4a5568'];
  function corDoProfessor(nome) {
    const lista = D.profsOrdenados || (D.profsOrdenados = Array.from(new Set(S.turmas.map(function (t) { return t.professor || '—'; }))).sort());
    const i = lista.indexOf(nome || '—');
    return PROF_CORES[(i < 0 ? 0 : i) % PROF_CORES.length];
  }
  function itemTurmaHTML(t) {
    const oculto = V.semProfsOcultos[t.professor || '—'];
    return '<div class="grade-item' + (oculto ? ' dim' : '') + '" style="--pc:' + corDoProfessor(t.professor) + '" data-act="ver-turma" data-id="' + t.id + '">' +
      '<div class="gi-hora">' + esc(t.horario) + '</div><div class="gi-turma">' + esc(t.turma) + '</div>' +
      '<div class="gi-prof">' + esc(t.professor || '') + (t.sala ? (' · ' + esc(t.sala)) : '') + '</div></div>';
  }
  function itemCompromissoHTML(c) {
    return '<div class="grade-item compromisso" data-act="ir-aba" data-view="compromissos">' +
      '<div class="gi-hora">' + esc(c.horario || 'sem horário') + ' · 📅</div><div class="gi-turma">' + esc(c.titulo) + '</div>' +
      '<div class="gi-prof">' + esc(c.comQuem || '') + '</div></div>';
  }
  /* Separa, dentro do dia de HOJE, as turmas cujo horário já terminou (segundo o relógio agora)
     das que ainda vão rolar — só faz sentido pro dia de hoje; nos outros dias (passados ou
     futuros) a lista inteira continua igual, sem essa separação. Turma com horário que não dá
     pra entender (texto fora do padrão) fica do lado "futuras", pra nunca sumir por engano. */
  function separarJaAconteceu(lista, ehHoje) {
    if (!ehHoje) return { futuras: lista, passadas: [] };
    const futuras = [], passadas = [];
    lista.forEach(function (t) {
      const hm = L.horarioMin(t.horario);
      if (hm && hm[1] <= AGORA_MIN) passadas.push(t); else futuras.push(t);
    });
    return { futuras: futuras, passadas: passadas };
  }
  function blocoJaAconteceu(passadas) {
    if (!passadas.length) return '';
    return '<details class="ja-aconteceu"><summary>Já aconteceu hoje (' + passadas.length + ')</summary>' +
      passadas.map(itemTurmaHTML).join('') + '</details>';
  }
  function viewSemana() {
    if (V.semanaModo === 'dia') return viewDia();
    const segunda = L.somaDias(L.segundaDaSemana(HOJE), V.semanaOffset * 7);
    const semestreSemana = L.semestreDeData(segunda);
    const turmasDoSemestreTodas = S.turmas.filter(function (t) { return t.semestre === semestreSemana && t.situacao !== 'A confirmar'; });
    // Turma sem nenhum aluno ainda matriculado não ajuda a enxergar a rotina da semana (e ainda
    // mais com muitas turmas no dia, ela só disputa espaço visual) — deixamos essas só na lista
    // "Turmas em formação" logo abaixo da grade, junto com as que estão "A confirmar".
    const turmasDoSemestre = turmasDoSemestreTodas.filter(function (t) { return (t.alunosNomes || []).length > 0; });
    const semAluno = turmasDoSemestreTodas.filter(function (t) { return (t.alunosNomes || []).length === 0; });
    const confirmar = S.turmas.filter(function (t) { return t.semestre === semestreSemana && t.situacao === 'A confirmar'; }).concat(semAluno);
    D.profsOrdenados = Array.from(new Set(turmasDoSemestre.map(function (t) { return t.professor || '—'; }))).sort();
    const grade = L.gradeSemanal(turmasDoSemestre);
    const diasSemana = L.DIAS_ORDEM.map(function (d, i) { return { id: d, data: L.somaDias(segunda, i) }; });
    const colunas = diasSemana.map(function (dia) {
      const listaTodas = grade[dia.id] || [];
      const compromissosDoDia = S.compromissos.filter(function (c) { return c.data === dia.data && c.status === 'agendado'; })
        .sort(function (a, b) { return (a.horario || '').localeCompare(b.horario || ''); });
      const ehHoje = dia.data === HOJE;
      const sep = separarJaAconteceu(listaTodas, ehHoje);
      const vazio = !sep.futuras.length && !compromissosDoDia.length && !sep.passadas.length;
      return '<div class="grade-col' + (ehHoje ? ' hoje' : '') + '"><div class="grade-col-h">' + L.DIAS_FULL[dia.id] + '<span class="grade-col-data">' + esc(L.fmtCurta(dia.data)) + '</span></div>' +
        compromissosDoDia.map(itemCompromissoHTML).join('') +
        sep.futuras.map(itemTurmaHTML).join('') +
        blocoJaAconteceu(sep.passadas) +
        (vazio ? '<div class="grade-vazio">—</div>' : '') + '</div>';
    }).join('');
    const faixa = L.fmtCurta(segunda) + ' – ' + L.fmtCurta(L.somaDias(segunda, 6)) + ' · semestre ' + semestreSemana;
    const legenda = D.profsOrdenados.map(function (nome) {
      const oculto = V.semProfsOcultos[nome];
      return '<button class="legenda-prof' + (oculto ? ' off' : '') + '" type="button" data-act="semana-prof-toggle" data-prof="' + esc(nome) + '">' +
        '<span class="legenda-bolha" style="--pc:' + corDoProfessor(nome) + '"></span>' + esc(nome) + '</button>';
    }).join('');
    return '<div class="topo"><h1>Semana</h1><div class="topo-acoes">' +
      '<div class="semana-modo"><button class="btn sm on" type="button" data-act="semana-modo" data-m="semana">Semana inteira</button><button class="btn sm" type="button" data-act="semana-modo" data-m="dia">Só um dia</button></div>' +
      '<button class="btn sm" type="button" data-act="semana-nav" data-d="-1">← Semana anterior</button>' +
      '<button class="btn sm" type="button" data-act="semana-nav" data-d="0">Hoje</button>' +
      '<button class="btn sm" type="button" data-act="semana-nav" data-d="1">Próxima semana →</button>' +
      '</div></div>' +
      '<p class="muted">' + esc(faixa) + '</p>' +
      (D.profsOrdenados.length > 1 ? ('<div class="legenda-profs"><span class="muted legenda-dica">Clique para destacar só as turmas de um(a) professor(a):</span>' + legenda + (Object.keys(V.semProfsOcultos).length ? '<button class="btn sm" type="button" data-act="semana-prof-limpar">Mostrar todos</button>' : '') + '</div>') : '') +
      '<div class="grade">' + colunas + '</div>' +
      (confirmar.length ? ('<h2 class="subtitulo">Turmas em formação (' + confirmar.length + ')</h2><p class="muted">A confirmar ou ainda sem nenhum aluno matriculado — por isso não aparecem na grade acima.</p><div class="lista-cards">' + confirmar.map(function (t) { return cardTurma(t); }).join('') + '</div>') : '');
  }

  /* ---------- Semana, modo "Só um dia": agenda vertical de um único dia, mais fácil de ler que
     7 colunas espremidas quando o que importa é só "o que tenho hoje" ---------- */
  function viewDia() {
    const dataAtual = L.somaDias(HOJE, V.diaOffsetDias);
    const diaId = L.diaDaSemana(dataAtual);
    const semestreDia = L.semestreDeData(dataAtual);
    const turmasDoSemestreTodas = S.turmas.filter(function (t) { return t.semestre === semestreDia && t.situacao !== 'A confirmar' && (t.alunosNomes || []).length > 0; });
    D.profsOrdenados = Array.from(new Set(turmasDoSemestreTodas.map(function (t) { return t.professor || '—'; }))).sort();
    const turmasDoDia = turmasDoSemestreTodas.filter(function (t) { return L.diasDaTurma(t.dia).indexOf(diaId) > -1; })
      .sort(function (a, b) { const ha = L.horarioMin(a.horario), hb = L.horarioMin(b.horario); return (ha ? ha[0] : 0) - (hb ? hb[0] : 0); });
    const compromissosDoDia = S.compromissos.filter(function (c) { return c.data === dataAtual && c.status === 'agendado'; })
      .sort(function (a, b) { return (a.horario || '').localeCompare(b.horario || ''); });
    const ehHoje = dataAtual === HOJE;
    const sep = separarJaAconteceu(turmasDoDia, ehHoje);
    // junta turmas (ainda por vir) e compromissos numa única lista, ordenada por horário
    const eventos = sep.futuras.map(function (t) { const hm = L.horarioMin(t.horario); return { ini: hm ? hm[0] : 9999, html: itemTurmaHTML(t) }; })
      .concat(compromissosDoDia.map(function (c) { const m = L.horaParaMin(c.horario); return { ini: m == null ? 9999 : m, html: itemCompromissoHTML(c) }; }))
      .sort(function (a, b) { return a.ini - b.ini; });
    const vazio = !eventos.length && !sep.passadas.length;
    return '<div class="topo"><h1>Semana</h1><div class="topo-acoes">' +
      '<div class="semana-modo"><button class="btn sm" type="button" data-act="semana-modo" data-m="semana">Semana inteira</button><button class="btn sm on" type="button" data-act="semana-modo" data-m="dia">Só um dia</button></div>' +
      '<button class="btn sm" type="button" data-act="dia-nav" data-d="-1">← Dia anterior</button>' +
      '<button class="btn sm" type="button" data-act="dia-nav" data-d="0">Hoje</button>' +
      '<button class="btn sm" type="button" data-act="dia-nav" data-d="1">Próximo dia →</button>' +
      '</div></div>' +
      '<p class="muted">' + esc(L.DIAS_FULL[diaId]) + ', ' + esc(L.fmtCurta(dataAtual)) + (ehHoje ? ' · hoje' : '') + ' · semestre ' + esc(semestreDia) + '</p>' +
      '<div class="agenda-dia">' +
      (eventos.length ? eventos.map(function (e) { return e.html; }).join('') : (vazio ? '<div class="grade-vazio">Nenhuma turma ou compromisso neste dia.</div>' : '')) +
      blocoJaAconteceu(sep.passadas) +
      '</div>';
  }

  /* ---------- Turmas ---------- */
  function viewTurmas() {
    let lista = S.turmas.filter(function (t) { return t.semestre === V.semestre; });
    if (V.fSit) lista = lista.filter(function (t) { return t.situacao === V.fSit; });
    const situacoes = Array.from(new Set(S.turmas.filter(function (t) { return t.semestre === V.semestre; }).map(function (t) { return t.situacao; }))).filter(Boolean).sort();
    const semBtns = D.semestres.map(function (s) { return '<button class="btn sm' + (V.semestre === s ? ' on' : '') + '" type="button" data-act="semestre" data-s="' + s + '">' + esc(s) + '</button>'; }).join('');
    const encerram = lista.filter(function (t) { return t.encerraProxSemestre; });
    return '<div class="topo"><h1>Turmas</h1><div class="topo-acoes">' + semBtns + '<button class="btn sm on" type="button" data-act="nova-turma">+ Nova turma</button></div></div>' +
      '<div class="filtros">' +
      '<select data-act="filtro-sit"><option value="">Todas as situações</option>' + situacoes.map(function (s) { return '<option value="' + esc(s) + '"' + (V.fSit === s ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select>' +
      '<span class="muted">' + lista.length + ' turma(s)' + (encerram.length ? (' · ' + encerram.length + ' encerram no próximo semestre') : '') + '</span>' +
      '</div>' +
      '<div class="lista-cards">' + lista.map(function (t) { return cardTurma(t); }).join('') + '</div>';
  }

  function dlgTurma(id) {
    const t = D.turmaPorId[id];
    if (!t) return;
    const alunosDaTurma = (t.alunosNomes || []).map(function (nomeRaw) {
      const key = L.norm(nomeRaw.replace(/\s*[\(\*].*$/, '').replace(/\*$/, ''));
      const aluno = S.alunos.find(function (a) { return L.norm(a.nome) === key; });
      return { nomeRaw: nomeRaw, aluno: aluno };
    }).sort(function (x, y) { return L.norm(x.aluno ? x.aluno.nome : x.nomeRaw).localeCompare(L.norm(y.aluno ? y.aluno.nome : y.nomeRaw)); });
    const idsNaTurma = {};
    alunosDaTurma.forEach(function (x) { if (x.aluno) idsNaTurma[x.aluno.id] = true; });
    const candidatosAdicionar = S.alunos.filter(function (a) { return !idsNaTurma[a.id]; })
      .sort(function (a, b) { return L.norm(a.nome).localeCompare(L.norm(b.nome)); });
    abrirDlg('<article class="dlg-card"><header><h2>' + esc(t.turma) + '</h2><button class="x" data-act="fechar" aria-label="Fechar">✕</button></header>' +
      '<div class="dlg-corpo">' +
      '<p>' + esc(t.dia) + ' · ' + esc(t.horario) + (t.sala ? (' · ' + esc(t.sala)) : '') + ' · Professor(a): ' + esc(t.professor || '—') + '</p>' +
      '<p>' + sitBadge(t.situacao) + (t.encerraProxSemestre ? ' <span class="tag tag-aviso">Encerra no próximo semestre</span>' : '') + '</p>' +
      (t.obs ? ('<p class="muted">Obs.: ' + esc(t.obs) + '</p>') : '') +
      '<h3>Alunos (' + alunosDaTurma.length + ')</h3>' +
      (alunosDaTurma.length ? ('<ul class="lista-alunos">' + alunosDaTurma.map(function (x) {
        return '<li class="aluno-turma-linha' + (x.aluno && x.aluno.cancelado ? ' linha-cancelada' : '') + '"><div>' + esc(x.aluno ? x.aluno.nome : x.nomeRaw) + (x.aluno && x.aluno.cancelado ? ' <span class="tag tag-erro">Cancelado</span>' : '') + (x.aluno && x.aluno.telefone ? ('<span class="muted"> · ' + esc(x.aluno.telefone) + '</span>') : (!x.aluno ? '<span class="muted"> · sem cadastro de aluno</span>' : '')) + '</div>' +
          '<div class="aluno-turma-acoes">' +
          (x.aluno ? '<button class="link" type="button" data-act="ver-aluno" data-id="' + x.aluno.id + '">ver cadastro</button>' : '') +
          (x.aluno && x.aluno.telefone ? ('<a class="btn sm" target="_blank" rel="noopener" href="' + L.linkWhatsApp(x.aluno.telefone, '') + '">WhatsApp</a>') : '') +
          (x.aluno ? ('<button class="btn sm" type="button" data-act="turma-remover-aluno" data-turma="' + t.id + '" data-aluno="' + x.aluno.id + '">Remover da turma</button>') : '') +
          '</div></li>';
      }).join('') + '</ul>') : '<p class="muted">Nenhum aluno registrado nesta turma.</p>') +
      (candidatosAdicionar.length ? ('<div class="campo"><label>Adicionar aluno já cadastrado a esta turma</label>' +
        '<div class="aluno-turma-acoes">' +
        '<select id="add-aluno-turma-select"><option value="">Selecione um aluno…</option>' +
        candidatosAdicionar.map(function (a) { return '<option value="' + a.id + '">' + esc(a.nome) + '</option>'; }).join('') + '</select>' +
        '<button class="btn sm" type="button" data-act="turma-adicionar-aluno" data-turma="' + t.id + '">Adicionar</button>' +
        '</div></div>') : '') +
      '<div class="ct-acoes">' +
      '<button class="btn sm" type="button" data-act="editar-turma" data-id="' + t.id + '">Editar turma</button>' +
      '<button class="btn sm" type="button" data-act="baixar-ics" data-id="' + t.id + '">Baixar .ics</button>' +
      (linkGoogleCalendar(t) ? ('<a class="btn sm" target="_blank" rel="noopener" href="' + linkGoogleCalendar(t) + '">Adicionar ao Google Agenda</a>') : '') +
      '</div></div></article>');
  }

  /* ---------- Criar / editar / excluir turma ---------- */
  const SITUACOES_TURMA = ['Em andamento', 'Em formação', 'A confirmar', 'Finalizada', 'Não formou turma'];
  function dlgEditarTurma(id) {
    const t = id ? D.turmaPorId[id] : null;
    abrirDlg('<article class="dlg-card"><header><h2>' + (t ? 'Editar turma' : 'Nova turma') + '</h2><button class="x" data-act="fechar" aria-label="Fechar">✕</button></header>' +
      '<div class="dlg-corpo">' +
      '<div class="campos-matricula">' +
      '<div class="campo"><label>Nome da turma</label><input type="text" id="et-turma" value="' + esc(t ? t.turma : '') + '" placeholder="Ex.: Kids 5"></div>' +
      '<div class="campo"><label>Semestre</label><input type="text" id="et-semestre" value="' + esc(t ? t.semestre : V.semestre) + '" placeholder="Ex.: 2026.2"></div>' +
      '<div class="campo"><label>Dia(s) da semana</label><input type="text" id="et-dia" value="' + esc(t ? t.dia : '') + '" placeholder="Ex.: SEG/QUA"></div>' +
      '<div class="campo"><label>Horário</label><input type="text" id="et-horario" value="' + esc(t ? t.horario : '') + '" placeholder="Ex.: 18h - 19h"></div>' +
      '<div class="campo"><label>Professor(a)</label><input type="text" id="et-professor" value="' + esc(t ? (t.professor || '') : '') + '" placeholder="Nome do(a) professor(a)"></div>' +
      '<div class="campo"><label>Sala</label><input type="text" id="et-sala" value="' + esc(t ? (t.sala || '') : '') + '" placeholder="Ex.: Sala 2"></div>' +
      '<div class="campo"><label>Situação</label><select id="et-situacao">' + SITUACOES_TURMA.map(function (s) { return '<option value="' + esc(s) + '"' + (t && t.situacao === s ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select></div>' +
      '</div>' +
      '<div class="campo"><label>Observação</label><input type="text" id="et-obs" value="' + esc(t ? (t.obs || '') : '') + '" placeholder="Opcional"></div>' +
      '<div class="ct-acoes">' +
      '<button class="btn sm on" type="button" data-act="salvar-turma" data-id="' + (t ? t.id : '') + '">Salvar</button>' +
      (t ? ('<button class="btn sm" type="button" data-act="excluir-turma" data-id="' + t.id + '">Excluir turma</button>') : '') +
      '</div></div></article>');
  }

  /* ---------- Matrículas ---------- */
  function checklistCompleta(m) {
    return !!(m.checklist.sistemaWashington && m.checklist.contratoAssinado && m.checklist.materialCobrado && (m.formaPagamento === 'unidade' || m.checklist.boletoAsaas));
  }
  const fmtReais = function (v) { return (v === '' || v == null || isNaN(Number(v))) ? '' : 'R$ ' + Number(v).toFixed(2).replace('.', ','); };

  function cardMatricula(m) {
    const t = D.turmaPorId[m.turmaId];
    const dias = L.diasAte(m.contratoFim);
    const completa = checklistCompleta(m);
    let tagContrato = '<span class="tag tag-ok">Contrato em dia</span>';
    if (dias != null) {
      if (dias < 0) tagContrato = '<span class="tag tag-erro">Contrato venceu há ' + Math.abs(dias) + ' dia(s)</span>';
      else if (dias <= 30) tagContrato = '<span class="tag tag-aviso">Rematrícula em ' + dias + ' dia(s)</span>';
    }
    return '<div class="card-turma" data-matricula="' + m.id + '">' +
      '<div class="ct-topo"><b>' + esc(m.alunoNome) + '</b>' + (completa ? '<span class="tag tag-ok">Checklist completo</span>' : '<span class="tag tag-aviso">Checklist pendente</span>') + '</div>' +
      '<div class="ct-linha">Turma: ' + esc(t ? t.turma : m.turmaNome) + (t ? (' · ' + esc(t.dia) + ' ' + esc(t.horario)) : '') + '</div>' +
      '<div class="ct-linha">Início: ' + esc(m.dataInicio) + ' · Contrato até ' + esc(m.contratoFim) + ' ' + tagContrato + '</div>' +
      '<div class="ct-linha">Pagamento: ' + (m.formaPagamento === 'unidade' ? 'Na unidade' : 'Asaas') + (m.dataPagamento ? (' · pago em ' + esc(m.dataPagamento)) : '') + '</div>' +
      '<div class="ct-linha">Mensalidade: ' + (fmtReais(m.valorMensalidade) || '—') + (m.desconto && m.desconto.tem ? ('<span class="tag tag-aviso">Desconto no 1º mês' + (m.desconto.valor ? (': ' + esc(fmtReais(m.desconto.valor))) : '') + '</span>') : '') + '</div>' +
      (m.desconto && m.desconto.tem && m.desconto.obs ? ('<div class="ct-linha muted">Obs. desconto: ' + esc(m.desconto.obs) + '</div>') : '') +
      '<div class="ct-linha">Material: ' + esc(m.livro || '—') + (m.valorMaterial ? (' · ' + esc(fmtReais(m.valorMaterial))) : '') + '</div>' +
      '<div class="check"><label><input type="checkbox" data-act="chk-matricula" data-id="' + m.id + '" data-campo="sistemaWashington"' + (m.checklist.sistemaWashington ? ' checked' : '') + '> Subiu matrícula no sistema da Washington</label></div>' +
      (m.formaPagamento === 'unidade' ? '' : ('<div class="check"><label><input type="checkbox" data-act="chk-matricula" data-id="' + m.id + '" data-campo="boletoAsaas"' + (m.checklist.boletoAsaas ? ' checked' : '') + '> Subiu boleto no Asaas</label></div>')) +
      '<div class="check"><label><input type="checkbox" data-act="chk-matricula" data-id="' + m.id + '" data-campo="contratoAssinado"' + (m.checklist.contratoAssinado ? ' checked' : '') + '> Responsável assinou o contrato</label></div>' +
      '<div class="check"><label><input type="checkbox" data-act="chk-matricula" data-id="' + m.id + '" data-campo="materialCobrado"' + (m.checklist.materialCobrado ? ' checked' : '') + '> Cobrado para comprar o material/livro</label></div>' +
      '<div class="campo"><label>Livro didático</label><input type="text" data-act="livro-matricula" data-id="' + m.id + '" value="' + esc(m.livro || '') + '" placeholder="Qual livro o aluno precisa comprar"></div>' +
      '<div class="ct-acoes">' +
      (D.alunoPorId[m.alunoId] && D.alunoPorId[m.alunoId].telefone ? ('<a class="btn sm" target="_blank" rel="noopener" href="' + L.linkWhatsApp(D.alunoPorId[m.alunoId].telefone, L.mensagemMaterialDidatico(D.alunoPorId[m.alunoId], t, m.livro)) + '">Avisar sobre o livro</a>') : '<span class="muted">Cadastre o telefone do aluno para avisar sobre o livro</span>') +
      '<button class="btn sm" type="button" data-act="editar-matricula" data-id="' + m.id + '">Editar matrícula</button>' +
      '<button class="btn sm" type="button" data-act="excluir-matricula" data-id="' + m.id + '">Excluir matrícula</button>' +
      '</div></div>';
  }

  /* Edição de uma matrícula já lançada (corrige erro de preenchimento num rascunho, por exemplo). */
  function dlgEditarMatricula(id) {
    const m = D.matriculaPorId[id];
    if (!m) return;
    abrirDlg('<article class="dlg-card"><header><h2>Editar matrícula — ' + esc(m.alunoNome) + '</h2><button class="x" data-act="fechar" aria-label="Fechar">✕</button></header>' +
      '<div class="dlg-corpo">' +
      '<div class="campos-matricula">' +
      '<div class="campo"><label>Turma</label><select id="em-turma">' + S.turmas.slice().sort(function (a, b) { return L.norm(a.turma).localeCompare(L.norm(b.turma)); })
        .map(function (t) { return '<option value="' + t.id + '"' + (m.turmaId === t.id ? ' selected' : '') + '>' + esc(t.turma) + ' · ' + esc(t.semestre) + '</option>'; }).join('') + '</select></div>' +
      '<div class="campo"><label>Data de início</label><input type="date" id="em-data" value="' + esc(m.dataInicio) + '"></div>' +
      '<div class="campo"><label>Data de pagamento</label><input type="date" id="em-data-pagamento" value="' + esc(m.dataPagamento || '') + '"></div>' +
      '<div class="campo"><label>Pagamento</label><select id="em-pagamento"><option value="asaas"' + (m.formaPagamento !== 'unidade' ? ' selected' : '') + '>Pelo Asaas</option><option value="unidade"' + (m.formaPagamento === 'unidade' ? ' selected' : '') + '>Na unidade</option></select></div>' +
      '<div class="campo"><label>Valor da mensalidade (R$)</label><input type="text" inputmode="decimal" id="em-valor-mensalidade" value="' + esc(m.valorMensalidade || '') + '"></div>' +
      '<div class="campo"><label>Livro didático (qual)</label><input type="text" id="em-livro" value="' + esc(m.livro || '') + '"></div>' +
      '<div class="campo"><label>Valor do material (R$)</label><input type="text" inputmode="decimal" id="em-valor-material" value="' + esc(m.valorMaterial || '') + '"></div>' +
      '</div>' +
      '<div class="check"><label><input type="checkbox" id="em-desconto-tem"' + (m.desconto && m.desconto.tem ? ' checked' : '') + '> Teve desconto especial no primeiro mês</label></div>' +
      '<div class="campos-matricula">' +
      '<div class="campo"><label>Valor com desconto (R$)</label><input type="text" inputmode="decimal" id="em-desconto-valor" value="' + esc(m.desconto ? (m.desconto.valor || '') : '') + '"></div>' +
      '<div class="campo"><label>Observação do desconto</label><input type="text" id="em-desconto-obs" value="' + esc(m.desconto ? (m.desconto.obs || '') : '') + '"></div>' +
      '</div>' +
      '<div class="ct-acoes"><button class="btn sm on" type="button" data-act="salvar-matricula" data-id="' + m.id + '">Salvar</button></div>' +
      '</div></article>');
  }

  function viewMatriculas() {
    const turmasDoSemestre = S.turmas.filter(function (t) { return t.semestre === V.semestre; });
    const opcoesAluno = S.alunos.slice().sort(function (a, b) { return L.norm(a.nome).localeCompare(L.norm(b.nome)); });
    const pendentes = S.matriculas.filter(function (m) { return !checklistCompleta(m); });
    const completas = S.matriculas.filter(checklistCompleta);
    const nm = V.novaMatricula;
    return '<div class="topo"><h1>Matrículas</h1></div>' +
      '<section class="bloco">' +
      '<h2>Registrar nova matrícula</h2>' +
      '<div class="campos-matricula">' +
      '<div class="campo"><label>Aluno (já cadastrado)</label><select data-act="nm-aluno"><option value="">— Novo aluno —</option>' +
      opcoesAluno.map(function (a) { return '<option value="' + a.id + '"' + (nm.alunoId === a.id ? ' selected' : '') + '>' + esc(a.nome) + '</option>'; }).join('') + '</select></div>' +
      (!nm.alunoId ? '<div class="campo"><label>Nome do novo aluno</label><input type="text" data-act="nm-nome" value="' + esc(nm.alunoNome) + '" placeholder="Nome completo"></div>' : '') +
      '<div class="campo"><label>Turma (semestre ' + esc(V.semestre) + ')</label><select data-act="nm-turma"><option value="">Selecione…</option>' +
      turmasDoSemestre.map(function (t) { return '<option value="' + t.id + '"' + (nm.turmaId === t.id ? ' selected' : '') + '>' + esc(t.turma) + ' · ' + esc(t.dia) + ' ' + esc(t.horario) + '</option>'; }).join('') + '</select></div>' +
      '<div class="campo"><label>Data de início</label><input type="date" data-act="nm-data" value="' + esc(nm.dataInicio) + '"></div>' +
      '<div class="campo"><label>Data de pagamento</label><input type="date" data-act="nm-data-pagamento" value="' + esc(nm.dataPagamento) + '"></div>' +
      '<div class="campo"><label>Pagamento</label><select data-act="nm-pagamento"><option value="asaas"' + (nm.formaPagamento !== 'unidade' ? ' selected' : '') + '>Pelo Asaas</option><option value="unidade"' + (nm.formaPagamento === 'unidade' ? ' selected' : '') + '>Na unidade</option></select></div>' +
      '<div class="campo"><label>Valor da mensalidade (R$)</label><input type="text" inputmode="decimal" data-act="nm-valor-mensalidade" value="' + esc(nm.valorMensalidade) + '" placeholder="Ex.: 207.00"></div>' +
      '<div class="campo"><label>Livro didático (qual)</label><input type="text" data-act="nm-livro" value="' + esc(nm.livro) + '" placeholder="Nome do livro"></div>' +
      '<div class="campo"><label>Valor do material (R$)</label><input type="text" inputmode="decimal" data-act="nm-valor-material" value="' + esc(nm.valorMaterial) + '" placeholder="Ex.: 298.20"></div>' +
      '</div>' +
      '<div class="check"><label><input type="checkbox" data-act="nm-desconto-tem"' + (nm.descontoTem ? ' checked' : '') + '> Teve desconto especial no primeiro mês</label></div>' +
      (nm.descontoTem ? ('<div class="campos-matricula">' +
        '<div class="campo"><label>Valor com desconto (R$)</label><input type="text" inputmode="decimal" data-act="nm-desconto-valor" value="' + esc(nm.descontoValor) + '" placeholder="Valor cobrado no 1º mês"></div>' +
        '<div class="campo"><label>Observação do desconto</label><input type="text" data-act="nm-desconto-obs" value="' + esc(nm.descontoObs) + '" placeholder="Ex.: promoção de matrícula"></div>' +
        '</div>') : '') +
      (nm.dataInicio ? ('<p class="muted">Contrato semestral: de ' + esc(nm.dataInicio) + ' até ' + esc(L.fimContrato(nm.dataInicio)) + '. Na virada, é preciso fazer a rematrícula e refazer o contrato.</p>') : '') +
      '<button class="btn on" type="button" data-act="add-matricula">Registrar matrícula</button>' +
      '</section>' +
      '<h2 class="subtitulo">Checklist pendente (' + pendentes.length + ')</h2>' +
      (pendentes.length ? ('<div class="lista-cards">' + pendentes.map(cardMatricula).join('') + '</div>') : '<p class="muted">Nenhuma matrícula pendente.</p>') +
      '<h2 class="subtitulo">Checklist completo (' + completas.length + ')</h2>' +
      (completas.length ? ('<div class="lista-cards">' + completas.map(cardMatricula).join('') + '</div>') : '<p class="muted">Nenhuma ainda.</p>');
  }

  /* ---------- Compromissos (reuniões, agenda com pais/responsáveis) ---------- */
  const QUEM_OPCOES = ['Isa', 'Camila', 'Isa e Camila'];
  function opcoesQuemTodas() {
    const profs = S.professores.map(function (p) { return p.nome; });
    return Array.from(new Set(QUEM_OPCOES.concat(profs)));
  }
  function statusCompromissoBadge(c) {
    if (c.status === 'realizado') return '<span class="tag tag-ok">Realizado</span>';
    if (c.status === 'cancelado') return '<span class="tag tag-neutro">Cancelado</span>';
    if (c.data && c.data < HOJE) return '<span class="tag tag-erro">Atrasado</span>';
    if (c.data === HOJE) return '<span class="tag tag-aviso">Hoje</span>';
    return '<span class="tag tag-neutro">Agendado</span>';
  }
  function cardCompromisso(c) {
    const aluno = c.alunoId ? D.alunoPorId[c.alunoId] : null;
    const nomeResp = aluno ? aluno.nome : c.alunoNome;
    return '<div class="card-turma" data-compromisso="' + c.id + '">' +
      '<div class="ct-topo"><b>' + esc(c.titulo) + '</b>' + statusCompromissoBadge(c) + '</div>' +
      '<div class="ct-linha">' + esc(L.fmtLonga(c.data)) + (c.horario ? (' às ' + esc(c.horario)) : '') + '</div>' +
      '<div class="ct-linha">Com: ' + esc(c.comQuem || '—') + (nomeResp ? (' · ' + esc(nomeResp)) : '') + (c.local ? (' · ' + esc(c.local)) : '') + '</div>' +
      (c.obs ? ('<div class="ct-linha muted">' + esc(c.obs) + '</div>') : '') +
      '<div class="ct-acoes">' +
      (c.status === 'agendado' ? ('<button class="btn sm" type="button" data-act="compromisso-status" data-id="' + c.id + '" data-st="realizado">Marcar realizado</button>' +
        '<button class="btn sm" type="button" data-act="compromisso-status" data-id="' + c.id + '" data-st="cancelado">Cancelar</button>') :
        '<button class="btn sm" type="button" data-act="compromisso-status" data-id="' + c.id + '" data-st="agendado">Reabrir</button>') +
      '<button class="btn sm" type="button" data-act="baixar-ics-compromisso" data-id="' + c.id + '">Baixar .ics</button>' +
      (aluno && aluno.telefone ? ('<a class="btn sm" target="_blank" rel="noopener" href="' + L.linkWhatsApp(aluno.telefone, L.mensagemConfirmacaoCompromisso(c, aluno.nome)) + '">Confirmar no WhatsApp</a>') : '') +
      '<button class="btn sm" type="button" data-act="excluir-compromisso" data-id="' + c.id + '">Excluir</button>' +
      '</div></div>';
  }
  function viewCompromissos() {
    const nc = V.novoCompromisso;
    const opcoesAluno = S.alunos.slice().sort(function (a, b) { return L.norm(a.nome).localeCompare(L.norm(b.nome)); });
    const todos = S.compromissos.slice().sort(function (a, b) { return (a.data + (a.horario || '')).localeCompare(b.data + (b.horario || '')); });
    const agendados = todos.filter(function (c) { return c.status === 'agendado'; });
    const hoje = agendados.filter(function (c) { return c.data === HOJE; });
    const atrasados = agendados.filter(function (c) { return c.data < HOJE; });
    const proximos = agendados.filter(function (c) { return c.data > HOJE; });
    const encerrados = todos.filter(function (c) { return c.status !== 'agendado'; });
    return '<div class="topo"><h1>Compromissos</h1></div>' +
      '<section class="bloco">' +
      '<h2>Agendar compromisso</h2>' +
      '<div class="campos-matricula">' +
      '<div class="campo"><label>Título</label><input type="text" data-act="nc-titulo" value="' + esc(nc.titulo) + '" placeholder="Ex.: Reunião com os pais da Fulana"></div>' +
      '<div class="campo"><label>Aluno (opcional)</label><select data-act="nc-aluno"><option value="">— Nenhum / outro —</option>' +
      opcoesAluno.map(function (a) { return '<option value="' + a.id + '"' + (nc.alunoId === a.id ? ' selected' : '') + '>' + esc(a.nome) + '</option>'; }).join('') + '</select></div>' +
      (!nc.alunoId ? '<div class="campo"><label>Nome (se não for aluno cadastrado)</label><input type="text" data-act="nc-nome" value="' + esc(nc.alunoNome) + '" placeholder="Ex.: responsável, visitante…"></div>' : '') +
      '<div class="campo"><label>Com quem</label><input type="text" list="lista-quem" data-act="nc-comquem" value="' + esc(nc.comQuem) + '" placeholder="Ex.: Isa, Camila, Isa e Camila, um(a) professor(a)…"></div>' +
      '<div class="campo"><label>Data</label><input type="date" data-act="nc-data" value="' + esc(nc.data) + '"></div>' +
      '<div class="campo"><label>Horário</label><input type="text" data-act="nc-horario" value="' + esc(nc.horario) + '" placeholder="Ex.: 14h30"></div>' +
      '<div class="campo"><label>Local</label><input type="text" data-act="nc-local" value="' + esc(nc.local) + '" placeholder="Ex.: Sala da coordenação, Google Meet…"></div>' +
      '</div>' +
      '<div class="campo"><label>Observação</label><input type="text" data-act="nc-obs" value="' + esc(nc.obs) + '" placeholder="Pauta, contexto…"></div>' +
      '<datalist id="lista-quem">' + opcoesQuemTodas().map(function (q) { return '<option value="' + esc(q) + '">'; }).join('') + '</datalist>' +
      '<button class="btn on" type="button" data-act="add-compromisso">Agendar</button>' +
      '</section>' +
      (hoje.length ? ('<h2 class="subtitulo">Hoje (' + hoje.length + ')</h2><div class="lista-cards">' + hoje.map(cardCompromisso).join('') + '</div>') : '') +
      (atrasados.length ? ('<h2 class="subtitulo">Atrasados (' + atrasados.length + ')</h2><div class="lista-cards">' + atrasados.map(cardCompromisso).join('') + '</div>') : '') +
      '<h2 class="subtitulo">Próximos (' + proximos.length + ')</h2>' +
      (proximos.length ? ('<div class="lista-cards">' + proximos.map(cardCompromisso).join('') + '</div>') : '<p class="muted">Nenhum compromisso futuro agendado.</p>') +
      (encerrados.length ? ('<h2 class="subtitulo">Realizados / cancelados (' + encerrados.length + ')</h2><div class="lista-cards">' + encerrados.map(cardCompromisso).join('') + '</div>') : '');
  }

  /* ---------- Frequência (chamada por turma/aula) ---------- */
  function alunosDaTurma(turmaId) {
    return S.alunos.filter(function (a) { return (a.turmas || []).some(function (x) { return x.turmaId === turmaId; }); })
      .sort(function (a, b) { return L.norm(a.nome).localeCompare(L.norm(b.nome)); });
  }
  function carregarChamadaForm() {
    V.chamadaPresencas = {};
    if (!V.chamadaTurmaId) return;
    const existente = D.chamadaPorChave[V.chamadaTurmaId + '|' + V.chamadaData];
    if (existente) {
      // só entram aqui os alunos que já tinham sido marcados (presente ou falta) nessa chamada;
      // quem não tiver marcação fica em branco mesmo, pra equipe marcar.
      Object.keys(existente.presencas || {}).forEach(function (id) { V.chamadaPresencas[id] = existente.presencas[id]; });
    }
  }
  function viewFrequencia() {
    const turmasDoSemestre = S.turmas.filter(function (t) { return t.semestre === V.semestre; });
    const semBtns = D.semestres.map(function (s) { return '<button class="btn sm' + (V.semestre === s ? ' on' : '') + '" type="button" data-act="semestre" data-s="' + s + '">' + esc(s) + '</button>'; }).join('');
    const turmaSel = D.turmaPorId[V.chamadaTurmaId];
    const alunosTurma = turmaSel ? alunosDaTurma(turmaSel.id) : [];
    const diaData = V.chamadaData ? L.diaDaSemana(V.chamadaData) : '';
    const diasTurma = turmaSel ? L.diasDaTurma(turmaSel.dia) : [];
    const diaConfere = !turmaSel || !V.chamadaData || diasTurma.indexOf(diaData) > -1;
    const existente = turmaSel ? D.chamadaPorChave[turmaSel.id + '|' + V.chamadaData] : null;
    const naoMarcados = alunosTurma.filter(function (a) { return V.chamadaPresencas[a.id] === undefined; }).length;
    const linhasAlunos = alunosTurma.map(function (a) {
      const valor = V.chamadaPresencas[a.id]; // true = presente, false = faltou, undefined = em branco
      const resumo = L.resumoFrequencia(S.frequencias, a.id);
      return '<div class="chamada-linha">' +
        '<span class="chamada-nome">' + esc(a.nome) + (resumo.total ? ('<span class="muted"> · ' + resumo.pct + '% presença (' + resumo.total + ' chamada(s))</span>') : '') + '</span>' +
        '<div class="chamada-botoes">' +
        '<button type="button" class="btn sm' + (valor === true ? ' on' : '') + '" data-act="fr-marcar" data-id="' + a.id + '" data-v="presente">Presente</button>' +
        '<button type="button" class="btn sm' + (valor === false ? ' on-erro' : '') + '" data-act="fr-marcar" data-id="' + a.id + '" data-v="falta">Faltou</button>' +
        '</div></div>';
    }).join('');
    const historico = turmaSel ? S.frequencias.filter(function (c) { return c.turmaId === turmaSel.id; }).sort(function (a, b) { return b.data.localeCompare(a.data); }) : [];
    const idsComChamada = Array.from(new Set(S.frequencias.reduce(function (acc, c) { return acc.concat(Object.keys(c.presencas || {})); }, [])));
    const alertas = idsComChamada.map(function (id) {
      const a = D.alunoPorId[id];
      if (!a) return null;
      const r = L.resumoFrequencia(S.frequencias, id);
      return (r.total >= 3 && r.pct < 75) ? { aluno: a, resumo: r } : null;
    }).filter(Boolean).sort(function (x, y) { return x.resumo.pct - y.resumo.pct; });
    return '<div class="topo"><h1>Frequência</h1><div class="topo-acoes">' + semBtns + '</div></div>' +
      '<section class="bloco">' +
      '<h2>Fazer chamada</h2>' +
      '<div class="campos-matricula">' +
      '<div class="campo"><label>Turma (semestre ' + esc(V.semestre) + ')</label><select data-act="fr-turma"><option value="">Selecione…</option>' +
      turmasDoSemestre.map(function (t) { return '<option value="' + t.id + '"' + (V.chamadaTurmaId === t.id ? ' selected' : '') + '>' + esc(t.turma) + ' · ' + esc(t.dia) + ' ' + esc(t.horario) + '</option>'; }).join('') + '</select></div>' +
      '<div class="campo"><label>Data da aula</label><input type="date" data-act="fr-data" value="' + esc(V.chamadaData) + '"></div>' +
      '</div>' +
      (turmaSel && !diaConfere ? ('<p class="muted">Atenção: ' + esc(L.fmtCurta(V.chamadaData)) + ' cai numa ' + esc((L.DIAS_FULL[diaData] || diaData).toLowerCase()) + ', mas essa turma é ' + esc(turmaSel.dia) + '. Confira a data antes de salvar.</p>') : '') +
      (turmaSel ? ((alunosTurma.length ? linhasAlunos : '<p class="muted">Nenhum aluno cadastrado nesta turma.</p>') +
        (naoMarcados ? ('<p class="muted">Faltam marcar ' + naoMarcados + ' aluno(s).</p>') : '') +
        '<button class="btn on" type="button" data-act="salvar-chamada">' + (existente ? 'Atualizar chamada' : 'Salvar chamada') + '</button>') : '<p class="muted">Escolha uma turma para fazer a chamada.</p>') +
      '</section>' +
      (turmaSel && historico.length ? ('<h2 class="subtitulo">Histórico desta turma (' + historico.length + ')</h2><ul class="lista-log">' +
        historico.map(function (c) {
          const total = Object.keys(c.presencas || {}).length;
          const presentes = Object.values(c.presencas || {}).filter(Boolean).length;
          return '<li>' + esc(L.fmtCurta(c.data)) + ' · ' + presentes + '/' + total + ' presente(s) · <button class="link" type="button" data-act="editar-chamada" data-turma="' + c.turmaId + '" data-data="' + c.data + '">editar</button></li>';
        }).join('') + '</ul>') : '') +
      (alertas.length ? ('<h2 class="subtitulo">Faltas recorrentes (presença abaixo de 75%)</h2><ul class="lista-log">' +
        alertas.map(function (x) { return '<li><b>' + esc(x.aluno.nome) + '</b> · ' + x.resumo.pct + '% de presença (' + x.resumo.presencas + '/' + x.resumo.total + ')</li>'; }).join('') + '</ul>') : '');
  }

  /* ---------- Inadimplência (régua de cobrança) ---------- */
  function cardInadimplencia(a) {
    const temTel = !!a.telefone;
    const cob = a.cobranca || { etapa: 0, enviadoEm: '' };
    const etapasTxt = ['Lembrete', '2º aviso', 'Aviso final'];
    const turmasTxt = (a.turmas || []).map(function (x) { return x.turma; }).join(', ');
    return '<div class="card-turma">' +
      '<div class="ct-topo"><b>' + esc(a.nome) + '</b>' + pagamentoBadge(a.pagamento.status) + '</div>' +
      '<div class="ct-linha muted">' + esc(turmasTxt || '—') + (a.telefone ? (' · ' + esc(a.telefone)) : '') + '</div>' +
      (a.pagamento.obs ? ('<div class="ct-linha muted">' + esc(a.pagamento.obs) + '</div>') : '') +
      '<div class="campo"><label>Valor em aberto (R$)</label><input type="text" inputmode="decimal" data-act="valor-aberto-aluno" data-id="' + a.id + '" value="' + esc(a.pagamento.valorEmAberto || '') + '" placeholder="Ex.: 207.00"></div>' +
      (cob.etapa ? ('<div class="ct-linha">Última cobrança enviada: <b>' + esc(etapasTxt[cob.etapa - 1] || ('etapa ' + cob.etapa)) + '</b>' + (cob.enviadoEm ? (' · ' + relTempo(cob.enviadoEm)) : '') + '</div>') : '<div class="ct-linha muted">Nenhuma cobrança enviada ainda</div>') +
      '<div class="ct-acoes">' +
      (temTel ? [1, 2, 3].map(function (et) {
        return '<a class="btn sm" target="_blank" rel="noopener" data-act="cobranca-etapa" data-id="' + a.id + '" data-et="' + et + '" href="' + L.linkWhatsApp(a.telefone, L.mensagemCobranca(a, et)) + '">' + etapasTxt[et - 1] + '</a>';
      }).join('') : '<span class="muted">Cadastre o telefone do aluno para cobrar por WhatsApp</span>') +
      '</div></div>';
  }
  function viewInadimplencia() {
    const lista = S.alunos.filter(function (a) { return !a.bolsista && !a.cancelado && (a.pagamento.status === 'atrasado' || a.pagamento.status === 'pendente'); })
      .sort(function (a, b) {
        if (a.pagamento.status !== b.pagamento.status) return a.pagamento.status === 'atrasado' ? -1 : 1;
        return L.norm(a.nome).localeCompare(L.norm(b.nome));
      });
    const atrasados = lista.filter(function (a) { return a.pagamento.status === 'atrasado'; });
    const pendentes = lista.filter(function (a) { return a.pagamento.status === 'pendente'; });
    const totalAberto = lista.reduce(function (soma, a) { const v = Number(a.pagamento.valorEmAberto); return soma + (isNaN(v) ? 0 : v); }, 0);
    return '<div class="topo"><h1>Inadimplência</h1></div>' +
      '<p class="muted">' + atrasados.length + ' atrasado(s) · ' + pendentes.length + ' pendente(s)' + (totalAberto ? (' · total em aberto informado: ' + fmtReais(totalAberto)) : '') + '</p>' +
      (lista.length ? ('<div class="lista-cards">' + lista.map(cardInadimplencia).join('') + '</div>') : '<p class="muted">Nenhum aluno atrasado ou pendente agora. 🎉</p>');
  }

  /* ---------- Material didático (pedido e entrega por aluno) ---------- */
  function linhaMaterial(m) {
    return '<tr>' +
      '<td><b>' + esc(m.alunoNome) + '</b></td>' +
      '<td><input type="text" data-act="material-campo" data-id="' + m.id + '" data-campo="turmaNome" value="' + esc(m.turmaNome || '') + '" placeholder="Nível/turma"></td>' +
      '<td><input type="date" data-act="material-campo" data-id="' + m.id + '" data-campo="recebidoEm" value="' + esc(m.recebidoEm || '') + '"></td>' +
      '<td><button type="button" class="btn sm' + (m.pagoWashington ? ' on' : '') + '" data-act="material-toggle" data-id="' + m.id + '" data-campo="pagoWashington">' + (m.pagoWashington ? 'Pago' : 'Não pago') + '</button></td>' +
      '<td><input type="date" data-act="material-campo" data-id="' + m.id + '" data-campo="dataEnvio" value="' + esc(m.dataEnvio || '') + '"></td>' +
      '<td><input type="date" data-act="material-campo" data-id="' + m.id + '" data-campo="dataEntrega" value="' + esc(m.dataEntrega || '') + '"></td>' +
      '<td><button type="button" class="btn sm' + (m.entregue ? ' on' : '') + '" data-act="material-toggle" data-id="' + m.id + '" data-campo="entregue">' + (m.entregue ? 'Entregue' : 'Pendente') + '</button></td>' +
      '<td><input type="text" data-act="material-campo" data-id="' + m.id + '" data-campo="obs" value="' + esc(m.obs || '') + '" placeholder="Obs."></td>' +
      '<td><button type="button" class="btn sm" data-act="excluir-material" data-id="' + m.id + '">Excluir</button></td>' +
      '</tr>';
  }
  function viewMaterial() {
    const nm = V.novoMaterial;
    const opcoesAluno = S.alunos.slice().sort(function (a, b) { return L.norm(a.nome).localeCompare(L.norm(b.nome)); });
    const semBtns = D.semestres.map(function (s) { return '<button class="btn sm' + (V.semestre === s ? ' on' : '') + '" type="button" data-act="semestre" data-s="' + s + '">' + esc(s) + '</button>'; }).join('');
    const lista = S.materiais.filter(function (m) { return m.semestre === V.semestre; })
      .sort(function (a, b) { return L.norm(a.alunoNome).localeCompare(L.norm(b.alunoNome)); });
    const pendentes = lista.filter(function (m) { return !m.entregue; });
    const entregues = lista.filter(function (m) { return m.entregue; });
    const cabecalho = '<thead><tr><th>Aluno</th><th>Nível/turma</th><th>Recebido em</th><th>Pago à Washington</th><th>Data de envio</th><th>Data de entrega</th><th>Entregue</th><th>Obs.</th><th></th></tr></thead>';
    return '<div class="topo"><h1>Material didático</h1><div class="topo-acoes">' + semBtns + '</div></div>' +
      '<section class="bloco">' +
      '<h2>Registrar pedido de material</h2>' +
      '<div class="campos-matricula">' +
      '<div class="campo"><label>Aluno (já cadastrado)</label><select data-act="mat-aluno"><option value="">— Outro / não cadastrado —</option>' +
      opcoesAluno.map(function (a) { return '<option value="' + a.id + '"' + (nm.alunoId === a.id ? ' selected' : '') + '>' + esc(a.nome) + '</option>'; }).join('') + '</select></div>' +
      (!nm.alunoId ? '<div class="campo"><label>Nome do aluno</label><input type="text" data-act="mat-nome" value="' + esc(nm.alunoNome) + '" placeholder="Nome completo"></div>' : '') +
      '<div class="campo"><label>Nível/turma</label><input type="text" data-act="mat-turma" value="' + esc(nm.turmaNome) + '" placeholder="Ex.: Prime 3 (2A)"></div>' +
      '<div class="campo"><label>Semestre</label><input type="text" data-act="mat-semestre" value="' + esc(nm.semestre) + '" placeholder="Ex.: 2026.2"></div>' +
      '<div class="campo"><label>Recebido em (pedido/pagamento)</label><input type="date" data-act="mat-recebido" value="' + esc(nm.recebidoEm) + '"></div>' +
      '</div>' +
      '<div class="check"><label><input type="checkbox" data-act="mat-pago"' + (nm.pagoWashington ? ' checked' : '') + '> Já pagou o material à Washington</label></div>' +
      '<div class="campo"><label>Observação</label><input type="text" data-act="mat-obs" value="' + esc(nm.obs) + '" placeholder="Opcional"></div>' +
      '<button class="btn on" type="button" data-act="add-material">Registrar</button>' +
      '</section>' +
      '<h2 class="subtitulo">Pendentes de entrega (' + pendentes.length + ')</h2>' +
      (pendentes.length ? ('<table class="tabela">' + cabecalho + '<tbody>' + pendentes.map(linhaMaterial).join('') + '</tbody></table>') : '<p class="muted">Nenhum pedido pendente neste semestre.</p>') +
      '<h2 class="subtitulo">Entregues (' + entregues.length + ')</h2>' +
      (entregues.length ? ('<table class="tabela">' + cabecalho + '<tbody>' + entregues.map(linhaMaterial).join('') + '</tbody></table>') : '<p class="muted">Nenhum ainda.</p>');
  }

  /* ---------- Entradas (dinheiro recebido: mensalidades, material, matrícula...) ---------- */
  const FORMAS_PAGAMENTO = ['Pix', 'Boleto', 'Cartão de crédito', 'Cartão de débito', 'Dinheiro', 'Transferência'];
  function mesDeData(d) { return (d || '').slice(0, 7); }
  function nomeMes(ym) {
    if (!/^\d{4}-\d{2}$/.test(ym || '')) return ym || '';
    const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const p = ym.split('-');
    return MESES[Number(p[1]) - 1] + ' de ' + p[0];
  }
  function mesesDisponiveis(lista) { return Array.from(new Set(lista.map(function (x) { return mesDeData(x.data); }).filter(Boolean))).sort().reverse(); }
  function linhaEntrada(e) {
    return '<tr>' +
      '<td><input type="date" data-act="en-editar-data" data-id="' + e.id + '" value="' + esc(e.data || '') + '"></td>' +
      '<td><b>' + esc(e.alunoNome || '—') + '</b></td>' +
      '<td>' + esc(fmtReais(e.valor) || '—') + '</td>' +
      '<td>' + esc(e.formaPagamento || '—') + '</td>' +
      '<td>' + esc(e.referente || '—') + (e.obs ? ('<div class="muted">' + esc(e.obs) + '</div>') : '') + '</td>' +
      '<td><button type="button" class="btn sm" data-act="excluir-entrada" data-id="' + e.id + '">Excluir</button></td>' +
      '</tr>';
  }
  function viewEntradas() {
    const ne = V.novaEntrada;
    const opcoesAluno = S.alunos.slice().sort(function (a, b) { return L.norm(a.nome).localeCompare(L.norm(b.nome)); });
    const meses = mesesDisponiveis(S.entradas);
    const lista = (V.fMesEntradas ? S.entradas.filter(function (e) { return mesDeData(e.data) === V.fMesEntradas; }) : S.entradas.slice())
      .sort(function (a, b) { return (b.data || '').localeCompare(a.data || ''); });
    const total = lista.reduce(function (s, e) { const v = Number(e.valor); return s + (isNaN(v) ? 0 : v); }, 0);
    return '<div class="topo"><h1>Entradas</h1></div>' +
      '<section class="bloco">' +
      '<h2>Registrar entrada</h2>' +
      '<div class="campos-matricula">' +
      '<div class="campo"><label>Data</label><input type="date" data-act="en-data" value="' + esc(ne.data) + '"></div>' +
      '<div class="campo"><label>Aluno (já cadastrado)</label><select data-act="en-aluno"><option value="">— Outro / não cadastrado —</option>' +
      opcoesAluno.map(function (a) { return '<option value="' + a.id + '"' + (ne.alunoId === a.id ? ' selected' : '') + '>' + esc(a.nome) + '</option>'; }).join('') + '</select></div>' +
      (!ne.alunoId ? '<div class="campo"><label>Nome (se não for aluno cadastrado)</label><input type="text" data-act="en-nome" value="' + esc(ne.alunoNome) + '" placeholder="Nome"></div>' : '') +
      '<div class="campo"><label>Valor (R$)</label><input type="text" inputmode="decimal" data-act="en-valor" value="' + esc(ne.valor) + '" placeholder="Ex.: 207.00"></div>' +
      '<div class="campo"><label>Forma de pagamento</label><select data-act="en-forma">' + FORMAS_PAGAMENTO.map(function (f) { return '<option value="' + esc(f) + '"' + (ne.formaPagamento === f ? ' selected' : '') + '>' + esc(f) + '</option>'; }).join('') + '</select></div>' +
      '<div class="campo"><label>Referente a</label><input type="text" list="lista-referente" data-act="en-referente" value="' + esc(ne.referente) + '" placeholder="Ex.: Mensalidade de outubro"></div>' +
      '</div>' +
      '<div class="campo"><label>Observação</label><input type="text" data-act="en-obs" value="' + esc(ne.obs) + '" placeholder="Opcional"></div>' +
      '<datalist id="lista-referente"><option value="Matrícula"><option value="Material Fluent"><option value="Aula particular"></datalist>' +
      '<button class="btn on" type="button" data-act="add-entrada">Registrar</button>' +
      '</section>' +
      '<div class="filtros">' +
      '<select data-act="filtro-mes-entradas"><option value="">Todos os meses</option>' + meses.map(function (m) { return '<option value="' + m + '"' + (V.fMesEntradas === m ? ' selected' : '') + '>' + esc(nomeMes(m)) + '</option>'; }).join('') + '</select>' +
      '<span class="muted">' + lista.length + ' lançamento(s) · total ' + fmtReais(total) + '</span>' +
      '</div>' +
      (lista.length ? ('<table class="tabela"><thead><tr><th>Data</th><th>Aluno</th><th>Valor</th><th>Forma</th><th>Referente a</th><th></th></tr></thead><tbody>' + lista.map(linhaEntrada).join('') + '</tbody></table>') : '<p class="muted">Nenhuma entrada registrada ainda.</p>');
  }

  /* ---------- Despesas (gastos do curso) ---------- */
  const CATEGORIAS_DESPESA = ['Hora Aula', 'Transporte', 'Custos Fixos', 'Limpeza/Descartáveis', 'Mercado', 'Papelaria', 'Salários', 'Equipamentos', 'Ações', 'Metas', 'Outro'];
  function opcoesQuemPagaDespesa() {
    const profs = S.professores.map(function (p) { return p.nome; });
    return Array.from(new Set(['Isabella', 'Camila', 'Conta do curso'].concat(profs)));
  }
  function linhaDespesa(d) {
    return '<tr>' +
      '<td><input type="date" data-act="de-editar-data" data-id="' + d.id + '" value="' + esc(d.data || '') + '"></td>' +
      '<td><b>' + esc(d.descricao) + '</b>' + (d.obs ? ('<div class="muted">' + esc(d.obs) + '</div>') : '') + '</td>' +
      '<td>' + esc(d.categoria || '—') + '</td>' +
      '<td>' + esc(fmtReais(d.valor) || '—') + '</td>' +
      '<td>' + esc(d.pagoPor || '—') + '</td>' +
      '<td><button type="button" class="btn sm' + (d.pago ? ' on' : '') + '" data-act="despesa-toggle" data-id="' + d.id + '">' + (d.pago ? 'Pago' : 'A pagar') + '</button></td>' +
      '<td><button type="button" class="btn sm" data-act="excluir-despesa" data-id="' + d.id + '">Excluir</button></td>' +
      '</tr>';
  }
  function viewDespesas() {
    const nd = V.novaDespesa;
    const meses = mesesDisponiveis(S.despesas);
    const lista = (V.fMesDespesas ? S.despesas.filter(function (d) { return mesDeData(d.data) === V.fMesDespesas; }) : S.despesas.slice())
      .sort(function (a, b) { return (b.data || '').localeCompare(a.data || ''); });
    const total = lista.reduce(function (s, d) { const v = Number(d.valor); return s + (isNaN(v) ? 0 : v); }, 0);
    const porCategoria = {};
    lista.forEach(function (d) { const v = Number(d.valor); porCategoria[d.categoria || 'Outro'] = (porCategoria[d.categoria || 'Outro'] || 0) + (isNaN(v) ? 0 : v); });
    const categoriasOrdenadas = Object.keys(porCategoria).sort(function (a, b) { return porCategoria[b] - porCategoria[a]; });
    return '<div class="topo"><h1>Despesas</h1></div>' +
      '<section class="bloco">' +
      '<h2>Registrar despesa</h2>' +
      '<div class="campos-matricula">' +
      '<div class="campo"><label>Data</label><input type="date" data-act="de-data" value="' + esc(nd.data) + '"></div>' +
      '<div class="campo"><label>Descrição</label><input type="text" data-act="de-descricao" value="' + esc(nd.descricao) + '" placeholder="Ex.: Aluguel, Mercado…"></div>' +
      '<div class="campo"><label>Categoria</label><select data-act="de-categoria">' + CATEGORIAS_DESPESA.map(function (c) { return '<option value="' + esc(c) + '"' + (nd.categoria === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></div>' +
      '<div class="campo"><label>Valor (R$)</label><input type="text" inputmode="decimal" data-act="de-valor" value="' + esc(nd.valor) + '" placeholder="Ex.: 150.00"></div>' +
      '<div class="campo"><label>Pago por</label><input type="text" list="lista-pagopor" data-act="de-pagopor" value="' + esc(nd.pagoPor) + '" placeholder="Ex.: Isabella, Camila, Conta do curso"></div>' +
      '</div>' +
      '<div class="check"><label><input type="checkbox" data-act="de-pago"' + (nd.pago ? ' checked' : '') + '> Já foi pago</label></div>' +
      '<div class="campo"><label>Observação</label><input type="text" data-act="de-obs" value="' + esc(nd.obs) + '" placeholder="Opcional"></div>' +
      '<datalist id="lista-pagopor">' + opcoesQuemPagaDespesa().map(function (q) { return '<option value="' + esc(q) + '">'; }).join('') + '</datalist>' +
      '<button class="btn on" type="button" data-act="add-despesa">Registrar</button>' +
      '</section>' +
      '<div class="filtros">' +
      '<select data-act="filtro-mes-despesas"><option value="">Todos os meses</option>' + meses.map(function (m) { return '<option value="' + m + '"' + (V.fMesDespesas === m ? ' selected' : '') + '>' + esc(nomeMes(m)) + '</option>'; }).join('') + '</select>' +
      '<span class="muted">' + lista.length + ' lançamento(s) · total ' + fmtReais(total) + '</span>' +
      '</div>' +
      (categoriasOrdenadas.length ? ('<p class="muted">' + categoriasOrdenadas.map(function (c) { return esc(c) + ': ' + fmtReais(porCategoria[c]); }).join(' · ') + '</p>') : '') +
      (lista.length ? ('<table class="tabela"><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Valor</th><th>Pago por</th><th>Status</th><th></th></tr></thead><tbody>' + lista.map(linhaDespesa).join('') + '</tbody></table>') : '<p class="muted">Nenhuma despesa registrada ainda.</p>');
  }

  /* ---------- Pendências (nada pode passar batido) ---------- */
  function opcoesTurmaSelect(selecionada) {
    return '<option value="">— Sem turma específica —</option>' + S.turmas.slice().sort(function (a, b) { return L.norm(a.turma).localeCompare(L.norm(b.turma)); })
      .map(function (t) { return '<option value="' + t.id + '"' + (selecionada === t.id ? ' selected' : '') + '>' + esc(t.turma) + ' · ' + esc(t.semestre) + '</option>'; }).join('');
  }
  function opcoesAlunoSelect(selecionado) {
    return '<option value="">— Sem aluno específico —</option>' + S.alunos.slice().sort(function (a, b) { return L.norm(a.nome).localeCompare(L.norm(b.nome)); })
      .map(function (a) { return '<option value="' + a.id + '"' + (selecionado === a.id ? ' selected' : '') + '>' + esc(a.nome) + '</option>'; }).join('');
  }
  function linhaPendencia(p) {
    const a = p.alunoId ? D.alunoPorId[p.alunoId] : null;
    const t = p.turmaId ? D.turmaPorId[p.turmaId] : null;
    const atrasada = !p.resolvida && p.prazo && p.prazo < HOJE;
    return '<div class="pendencia' + (p.resolvida ? ' resolvida' : '') + '">' +
      '<label class="check"><input type="checkbox" data-act="pendencia-toggle" data-id="' + p.id + '"' + (p.resolvida ? ' checked' : '') + '>' +
      '<span><b>' + esc(p.texto) + '</b>' +
      (a || t ? ('<div class="muted" style="font-size:.82rem">' + (a ? esc(a.nome) : '') + (a && t ? ' · ' : '') + (t ? esc(t.turma) : '') + '</div>') : '') +
      '</span></label>' +
      (p.prazo ? ('<span class="tag ' + (atrasada ? 'tag-erro' : 'tag-neutro') + '">prazo ' + esc(L.fmtCurta(p.prazo)) + '</span>') : '') +
      '<button class="btn sm" type="button" data-act="excluir-pendencia" data-id="' + p.id + '">Excluir</button>' +
      '</div>';
  }
  function viewPendencias() {
    const np = V.novaPendencia;
    let lista = S.pendencias.slice();
    if (V.fPendencia === 'abertas') lista = lista.filter(function (p) { return !p.resolvida; });
    lista.sort(function (a, b) { return (a.prazo || '9999').localeCompare(b.prazo || '9999'); });
    const nAbertas = S.pendencias.filter(function (p) { return !p.resolvida; }).length;
    return '<div class="topo"><h1>Pendências</h1></div>' +
      '<p class="muted">Use esta aba para anotar tudo o que precisa ser resolvido na unidade — documento faltando, aluno para ligar, contrato para assinar — para que nada passe batido.</p>' +
      '<section class="bloco">' +
      '<h2>Nova pendência</h2>' +
      '<div class="campo"><label>O que precisa ser feito</label><input type="text" data-act="pend-texto" value="' + esc(np.texto) + '" placeholder="Ex.: Pedir contrato assinado da Maria"></div>' +
      '<div class="campos-matricula">' +
      '<div class="campo"><label>Aluno (opcional)</label><select data-act="pend-aluno">' + opcoesAlunoSelect(np.alunoId) + '</select></div>' +
      '<div class="campo"><label>Turma (opcional)</label><select data-act="pend-turma">' + opcoesTurmaSelect(np.turmaId) + '</select></div>' +
      '<div class="campo"><label>Prazo (opcional)</label><input type="date" data-act="pend-prazo" value="' + esc(np.prazo) + '"></div>' +
      '</div>' +
      '<button class="btn on" type="button" data-act="add-pendencia">Adicionar</button>' +
      '</section>' +
      '<div class="filtros">' +
      '<select data-act="filtro-pendencia"><option value="abertas"' + (V.fPendencia === 'abertas' ? ' selected' : '') + '>Em aberto (' + nAbertas + ')</option><option value="todas"' + (V.fPendencia === 'todas' ? ' selected' : '') + '>Todas (' + S.pendencias.length + ')</option></select>' +
      '</div>' +
      (lista.length ? ('<div class="lista-pendencias">' + lista.map(linhaPendencia).join('') + '</div>') : '<p class="muted">Nenhuma pendência' + (V.fPendencia === 'abertas' ? ' em aberto' : '') + '.</p>');
  }

  /* ---------- Comunicados (mensagens em massa para alunos) ---------- */
  function alunosDoComunicado(c) {
    if (!c.turmaId) return S.alunos.filter(function (a) { return a.telefone; });
    const t = D.turmaPorId[c.turmaId];
    if (!t) return [];
    const nomes = (t.alunosNomes || []).map(function (n) { return L.norm(n.replace(/\s*[\(\*].*$/, '').replace(/\*$/, '')); });
    return S.alunos.filter(function (a) { return a.telefone && nomes.indexOf(L.norm(a.nome)) > -1; });
  }
  function linhaComunicado(c) {
    const t = c.turmaId ? D.turmaPorId[c.turmaId] : null;
    const alunosAlvo = alunosDoComunicado(c);
    const enviados = c.enviados || {};
    const nEnviados = alunosAlvo.filter(function (a) { return enviados[a.id]; }).length;
    return '<div class="bloco"><div class="ct-topo"><b>' + esc(L.fmtCurta(c.data)) + ' · ' + (t ? esc(t.turma) : 'Todos os alunos com WhatsApp') + '</b>' +
      '<span class="tag tag-neutro">' + nEnviados + ' / ' + alunosAlvo.length + ' enviado(s)</span>' +
      '<button class="btn sm" type="button" data-act="excluir-comunicado" data-id="' + c.id + '">Excluir</button></div>' +
      '<p>' + esc(c.mensagem) + '</p>' +
      (alunosAlvo.length ? ('<ul class="lista-alunos">' + alunosAlvo.map(function (a) {
        return '<li class="aluno-turma-linha"><div>' + esc(a.nome) + (enviados[a.id] ? ' <span class="tag tag-ok">Enviado</span>' : '') + '</div>' +
          '<div class="aluno-turma-acoes">' +
          '<a class="btn sm" target="_blank" rel="noopener" href="' + L.linkWhatsApp(a.telefone, c.mensagem) + '" data-act="comunicado-marcar-enviado" data-com="' + c.id + '" data-aluno="' + a.id + '">Abrir no WhatsApp</a>' +
          '</div></li>';
      }).join('') + '</ul>') : '<p class="muted">Nenhum aluno com telefone cadastrado nessa turma.</p>');
  }
  function viewComunicados() {
    const nc = V.novoComunicado;
    const lista = S.comunicados.slice().sort(function (a, b) { return (b.data || '').localeCompare(a.data || '') || (b.id || '').localeCompare(a.id || ''); });
    return '<div class="topo"><h1>Comunicados</h1></div>' +
      '<p class="muted">Escreva um aviso e dispare para todos os alunos de uma turma (ou de todas as turmas) por WhatsApp, acompanhando quem já recebeu.</p>' +
      '<section class="bloco">' +
      '<h2>Novo comunicado</h2>' +
      '<div class="campo"><label>Turma</label><select data-act="com-turma"><option value="">Todos os alunos com WhatsApp cadastrado</option>' +
      S.turmas.slice().sort(function (a, b) { return L.norm(a.turma).localeCompare(L.norm(b.turma)); }).map(function (t) { return '<option value="' + t.id + '"' + (nc.turmaId === t.id ? ' selected' : '') + '>' + esc(t.turma) + ' · ' + esc(t.semestre) + '</option>'; }).join('') + '</select></div>' +
      '<div class="campo"><label>Mensagem</label><textarea data-act="com-mensagem" rows="3" placeholder="Escreva o comunicado…">' + esc(nc.mensagem) + '</textarea></div>' +
      '<button class="btn on" type="button" data-act="gerar-comunicado">Gerar lista de envio</button>' +
      '</section>' +
      (lista.length ? lista.map(linhaComunicado).join('') : '<p class="muted">Nenhum comunicado disparado ainda.</p>');
  }

  /* ---------- Professores ---------- */
  function viewProfessores() {
    return '<div class="topo"><h1>Professores</h1></div>' +
      '<div class="lista-cards">' + S.professores.map(function (p, i) {
        const turmasDele = S.turmas.filter(function (t) { return L.norm(t.professor) === L.norm(p.nome); });
        return '<div class="card-turma">' +
          '<div class="ct-topo"><b>' + esc(p.nome) + '</b></div>' +
          '<div class="ct-linha">' + turmasDele.length + ' turma(s) no total</div>' +
          '<div class="campo"><label>Telefone (WhatsApp)</label><input type="text" data-act="tel-prof" data-i="' + i + '" value="' + esc(p.telefone || '') + '" placeholder="(21) 99999-9999"></div>' +
          (p.telefone ? ('<div class="ct-acoes"><a class="btn sm" target="_blank" rel="noopener" href="' + L.linkWhatsApp(p.telefone, 'Olá, ' + p.nome.split(' ')[0] + '! Aqui é da Washington Ilha.') + '">Chamar no WhatsApp</a></div>') : '') +
          '</div>';
      }).join('') + '</div>';
  }

  /* ---------- Alunos ---------- */
  const MOTIVOS_CANCELAMENTO = ['Mudou de cidade', 'Dificuldade financeira', 'Mudou de horário/turma', 'Concluiu o nível', 'Insatisfação', 'Outro'];
  function pagamentoBadge(st) {
    const cls = { 'em dia': 'tag-ok', atrasado: 'tag-erro', pendente: 'tag-aviso', desconhecido: 'tag-neutro' }[st] || 'tag-neutro';
    return '<span class="tag ' + cls + '">' + esc(st || 'desconhecido') + '</span>';
  }
  /* Bolsista não paga mensalidade e aluno cancelado já saiu — mostrar "desconhecido" ou qualquer
     outro status de pagamento ao lado deles só confunde, então nesses dois casos a gente troca o
     selo de pagamento pela própria tag (Bolsista / Cancelado). */
  function selosPagamentoAluno(a) {
    if (a.cancelado) return '<span class="tag tag-erro">Cancelado</span>';
    if (a.bolsista) return '<span class="tag tag-aviso">Bolsista</span>';
    return pagamentoBadge(a.pagamento.status);
  }
  /* A data de rematrícula não é um campo próprio do aluno: vem do contrato da matrícula mais
     recente dele (contratoFim). Pegamos a matrícula com o contrato que vence mais tarde. */
  function rematriculaInfoAluno(a) {
    const ms = S.matriculas.filter(function (m) { return m.alunoId === a.id && m.contratoFim; });
    if (!ms.length) return null;
    ms.sort(function (x, y) { return (y.contratoFim || '').localeCompare(x.contratoFim || ''); });
    const m = ms[0];
    return { contratoFim: m.contratoFim, dias: L.diasAte(m.contratoFim) };
  }
  function tagRematricula(info) {
    if (!info) return '<span class="tag tag-neutro">sem contrato cadastrado</span>';
    let cls = 'tag-ok', texto = 'rematrícula em ' + esc(L.fmtCurta(info.contratoFim));
    if (info.dias != null) {
      if (info.dias < 0) { cls = 'tag-erro'; texto = 'contrato venceu há ' + Math.abs(info.dias) + ' dia(s) (' + esc(L.fmtCurta(info.contratoFim)) + ')'; }
      else if (info.dias <= 30) { cls = 'tag-aviso'; texto = 'rematrícula em ' + info.dias + ' dia(s) (' + esc(L.fmtCurta(info.contratoFim)) + ')'; }
    }
    return '<span class="tag ' + cls + '">' + texto + '</span>';
  }
  /* ---------- Detecta possíveis alunos duplicados (mesma pessoa cadastrada 2x) ----------
     Isso acontece sobretudo quando um aluno é digitado de novo (com nome incompleto, ex.: só
     "Amanda") numa turma diferente da que ele está de verdade. Critérios, do mais confiável
     pro mais fraco: (1) mesmo telefone cadastrado; (2) nome normalizado idêntico; (3) um nome
     "cabe dentro" do outro (mesmo primeiro nome e todas as palavras do nome menor aparecem no
     nome maior, ex.: "Amanda" dentro de "Amanda Carla de Souza Santana"). */
  function nomeContidoNoOutro(nomeA, nomeB) {
    const tokA = L.norm(nomeA).split(/\s+/).filter(Boolean);
    const tokB = L.norm(nomeB).split(/\s+/).filter(Boolean);
    // Exige pelo menos 2 palavras no nome menor (ex.: "Amanda Carla"), senão um primeiro nome
    // comum (ex.: "Ana") bate com dezenas de alunas "Ana Alguma Coisa" sem ser duplicado nenhum.
    if (tokA.length < 2 || tokB.length < 2 || tokA[0] !== tokB[0]) return false;
    const menor = tokA.length <= tokB.length ? tokA : tokB;
    const maior = tokA.length <= tokB.length ? tokB : tokA;
    if (menor.length === maior.length) return false;
    return menor.every(function (t) { return maior.indexOf(t) > -1; });
  }
  function alunosDuplicadosProvaveis() {
    const idsUsados = {};
    const grupos = [];
    function addGrupo(lista) {
      const novos = lista.filter(function (a) { return !idsUsados[a.id]; });
      if (novos.length < 2) return;
      novos.forEach(function (a) { idsUsados[a.id] = true; });
      grupos.push(novos);
    }
    const porTelefone = {};
    S.alunos.forEach(function (a) {
      const tel = (a.telefone || '').replace(/\D/g, '');
      if (tel.length >= 8) (porTelefone[tel] = porTelefone[tel] || []).push(a);
    });
    Object.keys(porTelefone).forEach(function (k) { addGrupo(porTelefone[k]); });
    const porNome = {};
    S.alunos.forEach(function (a) {
      const n = L.norm(a.nome);
      if (n) (porNome[n] = porNome[n] || []).push(a);
    });
    Object.keys(porNome).forEach(function (k) { addGrupo(porNome[k]); });
    // Um primeiro-e-segundo-nome comum (ex.: "Maria Eduarda") pode "caber dentro" do nome de
    // várias alunas diferentes que não têm nada a ver uma com a outra — aí não é duplicado,
    // é coincidência de nome. Só junta pelo nome quando sobra EXATAMENTE 1 candidato; quando
    // o nome curto bate com 2+ alunos diferentes, é ambíguo demais pra juntar sozinho.
    const restantes = S.alunos.filter(function (a) { return !idsUsados[a.id]; });
    for (let i = 0; i < restantes.length; i++) {
      const a = restantes[i];
      if (idsUsados[a.id]) continue;
      const candidatos = [];
      for (let j = 0; j < restantes.length; j++) {
        if (j === i) continue;
        const b = restantes[j];
        if (!idsUsados[b.id] && nomeContidoNoOutro(a.nome, b.nome)) candidatos.push(b);
      }
      if (candidatos.length === 1) {
        const grupo = [a, candidatos[0]];
        grupo.forEach(function (x) { idsUsados[x.id] = true; });
        grupos.push(grupo);
      }
    }
    return grupos;
  }
  function cardAlunoDuplicado(grupo) {
    const idsGrupo = grupo.map(function (a) { return a.id; }).join(',');
    return '<div class="aviso aviso-atencao dup-card">' +
      '<p><b>Possível aluno duplicado:</b></p>' +
      '<ul>' + grupo.map(function (a) {
        const turmasTxt = (a.turmas || []).map(function (x) { return x.turma + ' (' + x.semestre + ')'; }).join(', ') || 'sem turma';
        return '<li>' + esc(a.nome) + (a.telefone ? (' · ' + esc(a.telefone)) : '') + ' · ' + esc(turmasTxt) + ' · ' + selosPagamentoAluno(a) + '</li>';
      }).join('') + '</ul>' +
      '<div class="dup-acoes">' + grupo.map(function (a) {
        return '<button class="btn sm" type="button" data-act="dup-mesclar" data-manter="' + a.id + '" data-grupo="' + idsGrupo + '">Manter "' + esc(a.nome) + '" e mesclar o(s) outro(s) aqui</button>';
      }).join(' ') + '</div>' +
      '</div>';
  }
  /* Linha de totais que aparece em cima das abas Alunos/Cancelados — visão rápida de tamanho da
     base, sem precisar contar ou rolar a tabela. */
  function linhaTotaisAlunos(nAlunosAtivos) {
    return '<div class="stats-topo">' +
      '<div class="stat-tile"><b>' + nAlunosAtivos + '</b><span>aluno(s) ativo(s)</span></div>' +
      '<div class="stat-tile"><b>' + S.turmas.length + '</b><span>turma(s) no total</span></div>' +
      '</div>';
  }
  function viewAlunos() {
    const ativos = S.alunos.filter(function (a) { return !a.cancelado; });
    let lista = ativos.slice();
    if (V.buscaAluno) {
      const q = L.norm(V.buscaAluno);
      lista = lista.filter(function (a) { return L.norm(a.nome).indexOf(q) > -1; });
    }
    if (V.fPag === 'bolsista') lista = lista.filter(function (a) { return a.bolsista; });
    else if (V.fPag === 'cancelamento') lista = lista.filter(function (a) { return a.cancelamento && a.cancelamento.solicitado; });
    else if (V.fPag) lista = lista.filter(function (a) { return (a.pagamento.status || 'desconhecido') === V.fPag; });
    lista.sort(function (a, b) { return L.norm(a.nome).localeCompare(L.norm(b.nome)); });
    const resumo = { 'em dia': 0, atrasado: 0, pendente: 0, desconhecido: 0 };
    let nBolsistas = 0, nCancelamento = 0;
    ativos.forEach(function (a) { const s = a.pagamento.status || 'desconhecido'; resumo[s] = (resumo[s] || 0) + 1; if (a.bolsista) nBolsistas++; if (a.cancelamento && a.cancelamento.solicitado) nCancelamento++; });
    const grupoDuplicados = alunosDuplicadosProvaveis();
    return '<div class="topo"><h1>Alunos (' + ativos.length + ')</h1></div>' +
      linhaTotaisAlunos(ativos.length) +
      (grupoDuplicados.length ? (
        '<h2 class="subtitulo">Possíveis duplicados (' + grupoDuplicados.length + ')</h2>' +
        '<p class="muted">Mesmo telefone ou nome parecido em mais de um cadastro — provavelmente a mesma pessoa cadastrada 2x. Escolha qual cadastro manter; os outros são mesclados nele (turmas, matrículas e histórico passam a contar para o que ficar) e removidos da lista.</p>' +
        grupoDuplicados.map(cardAlunoDuplicado).join('')
      ) : '') +
      '<div class="filtros">' +
      '<input type="search" placeholder="Buscar aluno por nome…" value="' + esc(V.buscaAluno) + '" data-act="busca-aluno">' +
      '<select data-act="filtro-pag"><option value="">Todos os pagamentos</option>' +
      ['em dia', 'pendente', 'atrasado', 'desconhecido'].map(function (s) { return '<option value="' + s + '"' + (V.fPag === s ? ' selected' : '') + '>' + s + ' (' + (resumo[s] || 0) + ')</option>'; }).join('') +
      '<option value="bolsista"' + (V.fPag === 'bolsista' ? ' selected' : '') + '>bolsistas (' + nBolsistas + ')</option>' +
      '<option value="cancelamento"' + (V.fPag === 'cancelamento' ? ' selected' : '') + '>cancelamento solicitado (' + nCancelamento + ')</option>' +
      '</select></div>' +
      '<table class="tabela"><thead><tr><th>Aluno</th><th>Turmas</th><th>Pagamento</th><th>Frequência</th><th>Rematrícula</th><th>Material</th><th></th></tr></thead><tbody>' +
      lista.map(function (a) {
        const turmasTxt = a.turmas.map(function (x) { return x.turma + ' (' + x.semestre + ')'; }).join(', ');
        return '<tr' + (a.cancelado ? ' class="linha-cancelada"' : '') + '>' +
          '<td><b>' + esc(a.nome) + '</b>' + (a.telefone ? ('<div class="muted">' + esc(a.telefone) + '</div>') : '') + '</td>' +
          '<td class="muted">' + esc(turmasTxt || '—') + '</td>' +
          '<td>' + selosPagamentoAluno(a) + (a.cancelamento && a.cancelamento.solicitado && !a.cancelado ? ' <span class="tag tag-erro">Cancelamento solicitado</span>' : '') + '</td>' +
          '<td class="muted">' + Object.keys(a.frequencia || {}).length + ' registro(s)</td>' +
          '<td>' + (a.rematricula.enviada ? '<span class="tag tag-ok">Enviada</span>' : '<span class="tag tag-neutro">Não enviada</span>') + '</td>' +
          '<td>' + (a.materialDidatico.enviado ? '<span class="tag tag-ok">Enviado</span>' : '<span class="tag tag-neutro">Não enviado</span>') + '</td>' +
          '<td>' +
          '<button class="btn sm" type="button" data-act="ver-aluno" data-id="' + a.id + '">Abrir</button> ' +
          (a.telefone ? ('<a class="btn sm" target="_blank" rel="noopener" href="' + L.linkWhatsApp(a.telefone, '') + '">WhatsApp</a>') : '') +
          '</td>' +
          '</tr>';
      }).join('') + '</tbody></table>';
  }

  /* ---------- Cancelados: aba própria pra quem já saiu, separada da lista principal de Alunos
     (continuam no sistema — histórico de turma preservado — só não disputam espaço ali). ---------- */
  function viewCancelados() {
    let lista = S.alunos.filter(function (a) { return a.cancelado; });
    if (V.buscaAlunoCancelado) {
      const q = L.norm(V.buscaAlunoCancelado);
      lista = lista.filter(function (a) { return L.norm(a.nome).indexOf(q) > -1; });
    }
    lista.sort(function (a, b) { return L.norm(a.nome).localeCompare(L.norm(b.nome)); });
    return '<div class="topo"><h1>Cancelados (' + lista.length + ')</h1></div>' +
      '<p class="muted">Alunos marcados como cancelados — saem da lista principal de Alunos, mas continuam aqui e na(s) turma(s) deles (com a tag "Cancelado"), guardando o histórico.</p>' +
      '<div class="filtros">' +
      '<input type="search" placeholder="Buscar aluno cancelado por nome…" value="' + esc(V.buscaAlunoCancelado || '') + '" data-act="busca-aluno-cancelado">' +
      '</div>' +
      (lista.length ? ('<table class="tabela"><thead><tr><th>Aluno</th><th>Turmas</th><th>Motivo do cancelamento</th><th></th></tr></thead><tbody>' +
        lista.map(function (a) {
          const turmasTxt = a.turmas.map(function (x) { return x.turma + ' (' + x.semestre + ')'; }).join(', ');
          return '<tr class="linha-cancelada">' +
            '<td><b>' + esc(a.nome) + '</b>' + (a.telefone ? ('<div class="muted">' + esc(a.telefone) + '</div>') : '') + '</td>' +
            '<td class="muted">' + esc(turmasTxt || '—') + '</td>' +
            '<td class="muted">' + esc((a.cancelamento && a.cancelamento.motivo) || '—') + '</td>' +
            '<td>' +
            '<button class="btn sm" type="button" data-act="ver-aluno" data-id="' + a.id + '">Abrir</button> ' +
            '<button class="btn sm" type="button" data-act="cancelado-toggle" data-id="' + a.id + '">Reativar</button>' +
            '</td>' +
            '</tr>';
        }).join('') + '</tbody></table>') : '<p class="muted">Nenhum aluno cancelado.</p>');
  }

  function dlgAluno(id) {
    const a = D.alunoPorId[id];
    if (!a) return;
    const temTel = !!a.telefone;
    abrirDlg('<article class="dlg-card"><header><h2>' + esc(a.nome) + '</h2><button class="x" data-act="fechar" aria-label="Fechar">✕</button></header>' +
      '<div class="dlg-corpo">' +
      '<h3>Dados do aluno</h3>' +
      '<div class="campos-matricula">' +
      '<div class="campo"><label>Nome</label><input type="text" data-act="nome-aluno" data-id="' + a.id + '" value="' + esc(a.nome || '') + '" placeholder="Nome completo"></div>' +
      '<div class="campo"><label>Telefone (WhatsApp)</label><input type="text" data-act="tel-aluno" data-id="' + a.id + '" value="' + esc(a.telefone || '') + '" placeholder="(21) 99999-9999"></div>' +
      '<div class="campo"><label>E-mail</label><input type="text" data-act="email-aluno" data-id="' + a.id + '" value="' + esc(a.email || '') + '" placeholder="nome@email.com"></div>' +
      '<div class="campo"><label>Onde paga</label><select data-act="forma-pagamento-aluno" data-id="' + a.id + '"><option value="asaas"' + (a.formaPagamento !== 'unidade' ? ' selected' : '') + '>Pelo Asaas</option><option value="unidade"' + (a.formaPagamento === 'unidade' ? ' selected' : '') + '>Na unidade (não entra na importação do Asaas)</option></select></div>' +
      '<div class="campo"><label>Nome de quem paga no Asaas (se for diferente do aluno)</label><input type="text" data-act="responsavel-financeiro-aluno" data-id="' + a.id + '" value="' + esc(a.responsavelFinanceiro || '') + '" placeholder="Ex.: nome do pai/mãe, se o boleto vier no nome dele(a)"></div>' +
      '<div class="campo"><label>Data que iniciou com a gente</label><input type="date" data-act="data-inicio-aluno" data-id="' + a.id + '" value="' + esc(a.dataInicio || '') + '"></div>' +
      '</div>' +
      '<div class="check"><label><input type="checkbox" data-act="bolsista-aluno" data-id="' + a.id + '"' + (a.bolsista ? ' checked' : '') + '> Aluno bolsista (não entra na cobrança/inadimplência)</label></div>' +
      '<div class="check"><label><input type="checkbox" data-act="livro-comprado-aluno" data-id="' + a.id + '"' + (a.livroDidatico.comprado ? ' checked' : '') + '> Já comprou o livro/material didático</label></div>' +
      '<h3>Cancelamento</h3>' +
      '<div class="check"><label><input type="checkbox" data-act="cancelamento-toggle" data-id="' + a.id + '"' + (a.cancelamento.solicitado ? ' checked' : '') + '> Aluno solicitou cancelamento</label></div>' +
      (a.cancelamento.solicitado ? (
        '<div class="campos-matricula">' +
        '<div class="campo"><label>Data do pedido</label><input type="date" data-act="cancelamento-data" data-id="' + a.id + '" value="' + esc(a.cancelamento.data || '') + '"></div>' +
        '<div class="campo"><label>Motivo</label><select data-act="cancelamento-motivo" data-id="' + a.id + '"><option value="">Selecione…</option>' +
        MOTIVOS_CANCELAMENTO.map(function (m) { return '<option value="' + esc(m) + '"' + (a.cancelamento.motivo === m ? ' selected' : '') + '>' + esc(m) + '</option>'; }).join('') + '</select></div>' +
        '</div>'
      ) : '') +
      '<h3>Turmas</h3><ul>' + (a.turmas || []).map(function (t) { return '<li>' + esc(t.turma) + ' · ' + esc(t.semestre) + '</li>'; }).join('') + '</ul>' +
      '<h3>Rematrícula</h3><p>' + tagRematricula(rematriculaInfoAluno(a)) + '</p>' +
      '<h3>Pagamento</h3><p>' + selosPagamentoAluno(a) + (a.pagamento.obs ? (' <span class="muted">' + esc(a.pagamento.obs) + '</span>') : '') + '</p>' +
      '<div class="campos-matricula">' +
      '<div class="campo"><label>Situação manual</label><select data-act="pag-status" data-id="' + a.id + '">' +
      ['desconhecido', 'em dia', 'pendente', 'atrasado'].map(function (s) { return '<option value="' + s + '"' + (a.pagamento.status === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div>' +
      '<div class="campo"><label>Valor em aberto (R$)</label><input type="text" inputmode="decimal" data-act="valor-aberto-aluno" data-id="' + a.id + '" value="' + esc(a.pagamento.valorEmAberto || '') + '" placeholder="Ex.: 207.00"></div>' +
      '<div class="campo"><label>Livro didático (qual)</label><input type="text" data-act="livro-aluno" data-id="' + a.id + '" value="' + esc(a.livroDidatico.qual || '') + '" placeholder="Nome do livro"></div>' +
      '</div>' +
      '<h3>Mandar mensagem no WhatsApp</h3>' +
      (temTel ? (
        '<div class="campo"><label>Mensagem livre</label><textarea id="msg-livre-aluno" rows="3" placeholder="Escreva aqui a mensagem e clique em Enviar…"></textarea></div>' +
        '<div class="ct-acoes"><button class="btn sm on" type="button" data-act="enviar-msg-livre" data-id="' + a.id + '">Enviar no WhatsApp</button></div>'
      ) : '<p class="muted">Cadastre o telefone acima para habilitar o envio de mensagens.</p>') +
      '<h3>Mensagens prontas (revise antes de mandar)</h3>' +
      '<div class="ct-acoes">' +
      (temTel ? '<a class="btn sm" target="_blank" rel="noopener" href="' + L.linkWhatsApp(a.telefone, L.mensagemRematricula(a, a.turmas && a.turmas[0])) + '" data-act="marcar-rematricula" data-id="' + a.id + '">Rematrícula</a>' : '<span class="muted">Cadastre o telefone para habilitar</span>') +
      (temTel ? '<a class="btn sm" target="_blank" rel="noopener" href="' + L.linkWhatsApp(a.telefone, L.mensagemMaterialDidatico(a, a.turmas && a.turmas[0], a.livroDidatico.qual)) + '" data-act="marcar-material" data-id="' + a.id + '">Material didático</a>' : '') +
      (temTel ? '<a class="btn sm" target="_blank" rel="noopener" href="' + L.linkWhatsApp(a.telefone, L.mensagemCobranca(a)) + '">Cobrança</a>' : '') +
      '</div>' +
      '<h3>Cancelar matrícula ou excluir aluno</h3>' +
      '<p class="muted">Use <b>Marcar como cancelado</b> quando o aluno realmente saiu — ele continua aparecendo no sistema e na(s) turma(s) dele (só com a tag "Cancelado"), para manter o histórico de que ele passou por ali. Use <b>Excluir aluno</b> só para cadastro duplicado ou criado por engano: aí sim ele some da lista e das turmas (o histórico de matrícula continua guardando o nome).</p>' +
      '<div class="ct-acoes">' +
      '<button class="btn sm' + (a.cancelado ? ' on' : '') + '" type="button" data-act="cancelado-toggle" data-id="' + a.id + '">' + (a.cancelado ? 'Reativar aluno (desmarcar cancelado)' : 'Marcar como cancelado') + '</button>' +
      '<button class="btn sm" type="button" data-act="excluir-aluno" data-id="' + a.id + '">Excluir aluno</button>' +
      '</div>' +
      '</div></article>');
  }

  /* ---------- Conferência ---------- */
  function viewConferencia() {
    const avisos = D.conflitos;
    return '<div class="topo"><h1>Conferência</h1></div>' +
      (avisos.length ? ('<div class="lista-avisos">' + avisos.map(function (w) {
        return '<div class="aviso aviso-' + (w.tipo === 'sem-sala' ? 'atencao' : 'erro') + '"><p>' + esc(w.msg) + '</p></div>';
      }).join('') + '</div>') : '<p class="muted">Nenhum choque de professor, sala ou falta de sala encontrado. 🎉</p>');
  }

  /* ---------- Buscar ---------- */
  function viewBuscar() {
    const q = L.norm(V.buscaTurma);
    let resTurmas = [], resProf = [], resAlunos = [];
    if (q) {
      resTurmas = S.turmas.filter(function (t) { return L.norm(t.turma + ' ' + t.professor + ' ' + t.sala).indexOf(q) > -1; });
      resProf = S.professores.filter(function (p) { return L.norm(p.nome).indexOf(q) > -1; });
      resAlunos = S.alunos.filter(function (a) { return L.norm(a.nome).indexOf(q) > -1; });
    }
    return '<div class="topo"><h1>Buscar</h1></div>' +
      '<input type="search" placeholder="Buscar turma, professor, sala ou aluno…" value="' + esc(V.buscaTurma) + '" data-act="busca-geral" class="busca-grande">' +
      (q ? (
        '<h2 class="subtitulo">Turmas (' + resTurmas.length + ')</h2><div class="lista-cards">' + resTurmas.map(function (t) { return cardTurma(t); }).join('') + '</div>' +
        '<h2 class="subtitulo">Professores (' + resProf.length + ')</h2><p>' + resProf.map(function (p) { return esc(p.nome); }).join(', ') + '</p>' +
        '<h2 class="subtitulo">Alunos (' + resAlunos.length + ')</h2><p>' + resAlunos.map(function (a) { return '<button class="link" type="button" data-act="ver-aluno" data-id="' + a.id + '">' + esc(a.nome) + '</button>'; }).join(', ') + '</p>'
      ) : '<p class="muted">Digite para buscar.</p>');
  }

  /* ---------- Dados ---------- */
  function viewDados() {
    const asaas = S.asaasImportado;
    return '<div class="topo"><h1>Dados</h1></div>' +
      '<section class="bloco">' +
      '<h2>Importar relatório do Asaas (pagamentos)</h2>' +
      '<p class="muted">Exporte o relatório de cobranças do Asaas em CSV e importe aqui para atualizar a situação de pagamento dos alunos. O pareamento é feito pelo nome do cliente — confira os que não encontrarem correspondência.</p>' +
      '<input type="file" accept=".csv,text/csv" data-act="importar-asaas">' +
      (asaas ? ('<p class="muted">Última importação: ' + esc(asaas.quando ? relTempo(asaas.quando) : '') + ' · ' + asaas.atualizados + ' aluno(s) atualizados' + (asaas.semMatch && asaas.semMatch.length ? (', ' + asaas.semMatch.length + ' sem correspondência') : '') + '</p>') : '') +
      '</section>' +
      '<section class="bloco">' +
      '<h2>Telefones</h2>' +
      '<p class="muted">Edite telefones de professores na aba Professores e de alunos ao abrir o cadastro em Alunos.</p>' +
      '</section>' +
      '<section class="bloco">' +
      '<h2>Sincronizar entre navegadores</h2>' +
      '<p class="muted">Status: <b>' + esc({ 'sem-config': 'desligada (cada navegador com seu próprio rascunho)', conectando: 'conectando…', sincronizado: 'sincronizado', erro: 'erro ao conectar' }[V.syncStatus] || V.syncStatus) + '</b>. Veja o README para configurar (precisa de um projeto Firebase próprio para este painel, separado do Polo 1740).</p>' +
      (Sync.configured() ? ('<p>Conectado como <b>' + esc(V.authEmail || '—') + '</b> · <button class="btn sm" type="button" data-act="sair">Sair</button></p>') : '') +
      '</section>' +
      '<section class="bloco">' +
      '<h2>Backup / publicar</h2>' +
      '<button class="btn" type="button" data-act="baixar-data">Baixar data.js para publicar</button>' +
      '</section>' +
      '<section class="bloco">' +
      '<h2>Atividade recente</h2>' +
      '<div class="campo"><label>Seu nome</label><input type="text" value="' + esc(S.cfg.autor || '') + '" data-act="salvar-autor" placeholder="Seu nome"></div>' +
      '<ul class="lista-log">' + (S.log || []).slice(0, 20).map(function (l) { return '<li>' + relTempo(l.ts) + ' · <b>' + esc(l.autor) + '</b> · ' + esc(l.acao) + (l.detalhe ? (': ' + esc(l.detalhe)) : '') + '</li>'; }).join('') + '</ul>' +
      '</section>';
  }

  /* ---------- Ações (data-act) ---------- */
  const ACTS = {
    'baixar-ics': function (el) { const t = D.turmaPorId[el.dataset.id]; if (t) L.baixarIcsTurma(t); },
    'ver-turma': function (el) { dlgTurma(el.dataset.id); },
    'nova-turma': function () { dlgEditarTurma(null); },
    'editar-turma': function (el) { dlgEditarTurma(el.dataset.id); },
    'salvar-turma': function (el) {
      const nome = $('#et-turma').value.trim();
      const semestre = $('#et-semestre').value.trim();
      if (!nome || !semestre) { toast('Preencha pelo menos o nome da turma e o semestre.'); return; }
      const dados = {
        turma: nome, semestre: semestre, dia: $('#et-dia').value.trim(), horario: $('#et-horario').value.trim(),
        professor: $('#et-professor').value.trim(), sala: $('#et-sala').value.trim(), situacao: $('#et-situacao').value, obs: $('#et-obs').value.trim(),
      };
      let t = el.dataset.id ? D.turmaPorId[el.dataset.id] : null;
      if (t) {
        Object.assign(t, dados);
        registrar('Editou turma', t.turma);
      } else {
        t = Object.assign({ id: proxId('tnovo', S.turmas), alunosNomes: [] }, dados);
        S.turmas.push(t);
        registrar('Criou turma', t.turma);
      }
      LS.set('turmas', S.turmas);
      fecharDlg();
      recalc(); render();
      toast(el.dataset.id ? 'Turma atualizada.' : 'Turma criada.');
    },
    'excluir-turma': function (el) {
      const t = D.turmaPorId[el.dataset.id];
      if (!t) return;
      if (typeof confirm === 'function' && !confirm('Excluir a turma "' + t.turma + '"? Os alunos matriculados nela deixam de tê-la no cadastro (o histórico de matrícula continua guardando o nome da turma).')) return;
      S.turmas = S.turmas.filter(function (x) { return x.id !== t.id; });
      S.alunos.forEach(function (a) { a.turmas = (a.turmas || []).filter(function (x) { return x.turmaId !== t.id; }); });
      LS.set('turmas', S.turmas); LS.set('alunos', S.alunos);
      registrar('Excluiu turma', t.turma);
      fecharDlg();
      recalc(); render();
      toast('Turma excluída.');
    },
    'turma-adicionar-aluno': function (el) {
      const t = D.turmaPorId[el.dataset.turma];
      const sel = $('#add-aluno-turma-select');
      const aluno = sel && sel.value ? D.alunoPorId[sel.value] : null;
      if (!t || !aluno) { toast('Escolha um aluno pra adicionar.'); return; }
      aluno.turmas = aluno.turmas || [];
      if (!aluno.turmas.some(function (x) { return x.turmaId === t.id; })) aluno.turmas.push({ turmaId: t.id, semestre: t.semestre, turma: t.turma });
      t.alunosNomes = t.alunosNomes || [];
      if (!t.alunosNomes.some(function (n) { return L.norm(n) === L.norm(aluno.nome); })) t.alunosNomes.push(aluno.nome);
      LS.set('alunos', S.alunos); LS.set('turmas', S.turmas);
      registrar('Incluiu aluno na turma', aluno.nome + ' em ' + t.turma);
      recalc();
      dlgTurma(t.id);
      render();
    },
    'turma-remover-aluno': function (el) {
      const t = D.turmaPorId[el.dataset.turma];
      const aluno = D.alunoPorId[el.dataset.aluno];
      if (!t || !aluno) return;
      aluno.turmas = (aluno.turmas || []).filter(function (x) { return x.turmaId !== t.id; });
      t.alunosNomes = (t.alunosNomes || []).filter(function (n) { return L.norm(n.replace(/\s*[\(\*].*$/, '').replace(/\*$/, '')) !== L.norm(aluno.nome); });
      LS.set('alunos', S.alunos); LS.set('turmas', S.turmas);
      registrar('Removeu aluno da turma', aluno.nome + ' de ' + t.turma);
      recalc();
      dlgTurma(t.id);
      render();
    },
    'ver-aluno': function (el) { fecharDlg(); dlgAluno(el.dataset.id); },
    fechar: function () { fecharDlg(); },
    semestre: function (el) { V.semestre = el.dataset.s; render(); },
    'semana-nav': function (el) { const d = Number(el.dataset.d); V.semanaOffset = d === 0 ? 0 : V.semanaOffset + d; render(); },
    'semana-modo': function (el) { V.semanaModo = el.dataset.m; render(); },
    'dia-nav': function (el) { const d = Number(el.dataset.d); V.diaOffsetDias = d === 0 ? 0 : V.diaOffsetDias + d; render(); },
    'semana-prof-toggle': function (el) {
      const nome = el.dataset.prof;
      if (V.semProfsOcultos[nome]) delete V.semProfsOcultos[nome]; else V.semProfsOcultos[nome] = true;
      render();
    },
    'semana-prof-limpar': function () { V.semProfsOcultos = {}; render(); },
    'ir-aba': function (el) { V.view = el.dataset.view; render(); },
    'filtro-sit': function (el) { V.fSit = el.value; render(); },
    'filtro-pag': function (el) { V.fPag = el.value; render(); },
    'busca-aluno': function (el) { V.buscaAluno = el.value; render(); },
    'busca-aluno-cancelado': function (el) { V.buscaAlunoCancelado = el.value; render(); },
    'busca-geral': function (el) { V.buscaTurma = el.value; render(); },
    'tel-prof': function (el) { S.professores[Number(el.dataset.i)].telefone = el.value; LS.set('professores', S.professores); registrar('Editou telefone de professor', S.professores[Number(el.dataset.i)].nome); },
    'tel-aluno': function (el) { const a = D.alunoPorId[el.dataset.id]; if (a) { a.telefone = el.value; LS.set('alunos', S.alunos); registrar('Editou telefone de aluno', a.nome); render(); } },
    'email-aluno': function (el) { const a = D.alunoPorId[el.dataset.id]; if (a) { a.email = el.value; LS.set('alunos', S.alunos); } },
    'enviar-msg-livre': function (el) {
      const a = D.alunoPorId[el.dataset.id];
      if (!a) return;
      const campo = $('#msg-livre-aluno');
      const texto = campo ? campo.value.trim() : '';
      if (!texto) { toast('Escreva a mensagem antes de enviar.'); return; }
      window.open(L.linkWhatsApp(a.telefone, texto), '_blank', 'noopener');
      registrar('Enviou mensagem livre por WhatsApp', a.nome);
    },
    'nome-aluno': function (el) {
      const a = D.alunoPorId[el.dataset.id];
      if (!a) return;
      const nomeAntigo = a.nome;
      const nomeNovo = el.value;
      a.nome = nomeNovo;
      if (nomeNovo.trim() && nomeNovo !== nomeAntigo) {
        (a.turmas || []).forEach(function (x) {
          const t = D.turmaPorId[x.turmaId];
          if (!t || !t.alunosNomes) return;
          const idx = t.alunosNomes.findIndex(function (n) { return L.norm(n.replace(/\s*[\(\*].*$/, '').replace(/\*$/, '')) === L.norm(nomeAntigo); });
          if (idx > -1) t.alunosNomes[idx] = nomeNovo;
        });
        S.matriculas.forEach(function (m) { if (m.alunoId === a.id) m.alunoNome = nomeNovo; });
        S.compromissos.forEach(function (c) { if (c.alunoId === a.id) c.alunoNome = nomeNovo; });
        LS.set('turmas', S.turmas); LS.set('matriculas', S.matriculas); LS.set('compromissos', S.compromissos);
      }
      LS.set('alunos', S.alunos);
      render();
    },
    'pag-status': function (el) { const a = D.alunoPorId[el.dataset.id]; if (a) { a.pagamento.status = el.value; a.pagamento.atualizadoEm = new Date().toISOString(); LS.set('alunos', S.alunos); registrar('Atualizou pagamento (manual)', a.nome + ' → ' + el.value); } },
    'responsavel-financeiro-aluno': function (el) {
      const a = D.alunoPorId[el.dataset.id];
      if (!a) return;
      a.responsavelFinanceiro = el.value;
      LS.set('alunos', S.alunos);
    },
    'bolsista-aluno': function (el) {
      const a = D.alunoPorId[el.dataset.id];
      if (!a) return;
      a.bolsista = el.checked;
      LS.set('alunos', S.alunos);
      registrar('Atualizou bolsista', a.nome + ' → ' + (a.bolsista ? 'bolsista' : 'não bolsista'));
      render();
    },
    /* Cancela a matrícula SEM remover o aluno do sistema nem das turmas — ele continua aparecendo
       (com a tag "Cancelado") para manter o histórico de que ele passou por ali. */
    'cancelado-toggle': function (el) {
      const a = D.alunoPorId[el.dataset.id];
      if (!a) return;
      a.cancelado = !a.cancelado;
      LS.set('alunos', S.alunos);
      registrar('Atualizou cancelamento efetivo', a.nome + ' → ' + (a.cancelado ? 'cancelado' : 'reativado'));
      render();
      // Só reabre o cadastro se ele já estava aberto (ex.: clicou o checkbox de dentro da ficha).
      // Clicando "Reativar" direto na lista da aba Cancelados, não precisa abrir o cadastro.
      const dlg = $('#dlg');
      if (dlg && dlg.open) dlgAluno(a.id);
    },
    'excluir-aluno': function (el) {
      const a = D.alunoPorId[el.dataset.id];
      if (!a) return;
      if (typeof confirm === 'function' && !confirm('Excluir o cadastro de "' + a.nome + '"? As matrículas e compromissos já registrados continuam guardando o nome dele, mas ele sai das turmas e da lista de alunos.')) return;
      S.alunos = S.alunos.filter(function (x) { return x.id !== a.id; });
      S.turmas.forEach(function (t) {
        t.alunosNomes = (t.alunosNomes || []).filter(function (n) { return L.norm(n.replace(/\s*[\(\*].*$/, '').replace(/\*$/, '')) !== L.norm(a.nome); });
      });
      LS.set('alunos', S.alunos); LS.set('turmas', S.turmas);
      registrar('Excluiu aluno', a.nome);
      fecharDlg();
      recalc(); render();
      toast('Aluno excluído.');
    },
    /* Mescla um (ou mais) cadastro(s) duplicado(s) dentro do cadastro escolhido pra manter.
       O(s) outro(s) saem da lista de alunos, mas tudo que eles tinham (turmas, matrículas,
       compromissos, materiais, entradas e pendências) passa a apontar para quem ficou — nada
       de histórico se perde, só deixa de estar espalhado em 2 cadastros. */
    'dup-mesclar': function (el) {
      const idManter = el.dataset.manter;
      const idsGrupo = (el.dataset.grupo || '').split(',').filter(Boolean);
      const manter = D.alunoPorId[idManter];
      if (!manter) return;
      const removerIds = idsGrupo.filter(function (id) { return id !== idManter; });
      const removerAlunos = removerIds.map(function (id) { return D.alunoPorId[id]; }).filter(Boolean);
      if (!removerAlunos.length) return;
      const nomesRemovidos = removerAlunos.map(function (a) { return a.nome; }).join(', ');
      if (typeof confirm === 'function' && !confirm('Mesclar "' + nomesRemovidos + '" dentro de "' + manter.nome + '"? As turmas, matrículas e histórico dos outros passam a contar para "' + manter.nome + '", e os cadastros duplicados saem da lista. Essa ação não pode ser desfeita.')) return;
      removerAlunos.forEach(function (rem) {
        (rem.turmas || []).forEach(function (x) {
          manter.turmas = manter.turmas || [];
          if (!manter.turmas.some(function (y) { return y.turmaId === x.turmaId; })) manter.turmas.push(x);
          const t = D.turmaPorId[x.turmaId];
          if (t && t.alunosNomes) {
            const idx = t.alunosNomes.findIndex(function (n) { return L.norm(n.replace(/\s*[\(\*].*$/, '').replace(/\*$/, '')) === L.norm(rem.nome); });
            if (idx > -1) {
              if (t.alunosNomes.some(function (n) { return L.norm(n.replace(/\s*[\(\*].*$/, '').replace(/\*$/, '')) === L.norm(manter.nome); })) {
                t.alunosNomes.splice(idx, 1);
              } else {
                t.alunosNomes[idx] = manter.nome;
              }
            }
          }
        });
        S.matriculas.forEach(function (m) { if (m.alunoId === rem.id) { m.alunoId = manter.id; m.alunoNome = manter.nome; } });
        S.compromissos.forEach(function (c) { if (c.alunoId === rem.id) { c.alunoId = manter.id; c.alunoNome = manter.nome; } });
        S.materiais.forEach(function (ma) { if (ma.alunoId === rem.id) { ma.alunoId = manter.id; ma.alunoNome = manter.nome; } });
        S.entradas.forEach(function (en) { if (en.alunoId === rem.id) { en.alunoId = manter.id; en.alunoNome = manter.nome; } });
        S.pendencias.forEach(function (p) { if (p.alunoId === rem.id) p.alunoId = manter.id; });
      });
      const idsRemoverSet = {};
      removerIds.forEach(function (id) { idsRemoverSet[id] = true; });
      S.alunos = S.alunos.filter(function (a) { return !idsRemoverSet[a.id]; });
      LS.set('alunos', S.alunos); LS.set('turmas', S.turmas); LS.set('matriculas', S.matriculas);
      LS.set('compromissos', S.compromissos); LS.set('materiais', S.materiais); LS.set('entradas', S.entradas); LS.set('pendencias', S.pendencias);
      registrar('Mesclou alunos duplicados', nomesRemovidos + ' → ' + manter.nome);
      toast('Cadastro(s) mesclado(s) em "' + manter.nome + '".');
      recalc(); render();
    },
    'marcar-rematricula': function (el) { const a = D.alunoPorId[el.dataset.id]; if (a) { a.rematricula.enviada = true; a.rematricula.data = new Date().toISOString(); LS.set('alunos', S.alunos); registrar('Marcou mensagem de rematrícula como enviada', a.nome); } },
    'marcar-material': function (el) { const a = D.alunoPorId[el.dataset.id]; if (a) { a.materialDidatico.enviado = true; a.materialDidatico.data = new Date().toISOString(); LS.set('alunos', S.alunos); registrar('Marcou material didático como enviado', a.nome); } },
    'salvar-autor': function (el) { S.cfg.autor = el.value; LS.set('cfg', S.cfg); },
    'forma-pagamento-aluno': function (el) { const a = D.alunoPorId[el.dataset.id]; if (a) { a.formaPagamento = el.value; LS.set('alunos', S.alunos); registrar('Definiu forma de pagamento', a.nome + ' → ' + el.value); render(); } },
    'livro-aluno': function (el) { const a = D.alunoPorId[el.dataset.id]; if (a) { a.livroDidatico.qual = el.value; LS.set('alunos', S.alunos); } },
    'data-inicio-aluno': function (el) { const a = D.alunoPorId[el.dataset.id]; if (a) { a.dataInicio = el.value; LS.set('alunos', S.alunos); } },
    'livro-comprado-aluno': function (el) {
      const a = D.alunoPorId[el.dataset.id];
      if (!a) return;
      a.livroDidatico.comprado = el.checked;
      LS.set('alunos', S.alunos);
      registrar('Atualizou livro comprado', a.nome + ' → ' + (a.livroDidatico.comprado ? 'comprou' : 'ainda não comprou'));
    },
    'cancelamento-toggle': function (el) {
      const a = D.alunoPorId[el.dataset.id];
      if (!a) return;
      a.cancelamento.solicitado = el.checked;
      if (el.checked && !a.cancelamento.data) a.cancelamento.data = HOJE;
      LS.set('alunos', S.alunos);
      registrar('Atualizou cancelamento', a.nome + ' → ' + (a.cancelamento.solicitado ? 'solicitou cancelamento' : 'cancelamento removido'));
      // render() atualiza a tabela de Alunos por baixo (a tag "Cancelamento solicitado"); como
      // render() nunca toca no <dialog>, reabrimos o cadastro também, para os campos de data/motivo
      // aparecerem ou somerem na hora.
      render();
      dlgAluno(a.id);
    },
    'cancelamento-data': function (el) { const a = D.alunoPorId[el.dataset.id]; if (a) { a.cancelamento.data = el.value; LS.set('alunos', S.alunos); } },
    'cancelamento-motivo': function (el) { const a = D.alunoPorId[el.dataset.id]; if (a) { a.cancelamento.motivo = el.value; LS.set('alunos', S.alunos); registrar('Definiu motivo de cancelamento', a.nome + ' → ' + el.value); } },
    'baixar-data': function () {
      const payload = { professores: S.professores, turmas: S.turmas, alunos: S.alunos, matriculas: S.matriculas, compromissos: S.compromissos, frequencias: S.frequencias, materiais: S.materiais, entradas: S.entradas, despesas: S.despesas, pendencias: S.pendencias, comunicados: S.comunicados };
      baixar('data.js', 'window.WASH_DATA = ' + JSON.stringify(payload, null, 1) + ';\n', 'text/javascript;charset=utf-8');
      toast('data.js baixado');
    },
    'importar-asaas': function (el) {
      const file = el.files && el.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function () {
        const linhas = L.parseAsaasCSV(String(reader.result));
        let atualizados = 0; const semMatch = [];
        linhas.forEach(function (l) {
          const key = L.norm(l.nome);
          const descNorm = l.descricao ? L.norm(l.descricao) : '';
          // 1) nome do aluno bate direto com o nome no boleto (caso raro, mas ideal);
          // 2) o boleto está no nome do responsável financeiro cadastrado na ficha do aluno
          //    (ex.: boleto no nome do pai/mãe — é o caso mais comum no Asaas);
          // 3) o nome do aluno aparece dentro da descrição/histórico do boleto (quando o Asaas
          //    exporta essa coluna e o nome do aluno foi escrito lá).
          let aluno = S.alunos.find(function (a) { return L.norm(a.nome) === key; });
          if (!aluno) aluno = S.alunos.find(function (a) { return a.responsavelFinanceiro && L.norm(a.responsavelFinanceiro) === key; });
          if (!aluno && descNorm) aluno = S.alunos.find(function (a) { return a.nome && descNorm.indexOf(L.norm(a.nome)) > -1; });
          if (aluno && aluno.formaPagamento !== 'unidade') {
            const statusNovo = L.statusPagamento(l.status);
            aluno.pagamento = Object.assign({}, aluno.pagamento, {
              status: statusNovo, obs: 'Asaas: ' + l.status + (l.vencimento ? (' · venc. ' + l.vencimento) : ''), atualizadoEm: new Date().toISOString(),
              valorEmAberto: (statusNovo === 'atrasado' || statusNovo === 'pendente') && l.valor ? l.valor.replace(',', '.') : aluno.pagamento.valorEmAberto,
            });
            atualizados++;
          } else if (!aluno) {
            semMatch.push(l.nome);
          }
        });
        LS.set('alunos', S.alunos);
        S.asaasImportado = { quando: new Date().toISOString(), atualizados: atualizados, semMatch: semMatch };
        LS.set('asaasImportado', S.asaasImportado);
        registrar('Importou relatório do Asaas', atualizados + ' aluno(s) atualizados');
        toast('Importação concluída: ' + atualizados + ' aluno(s) atualizados' + (semMatch.length ? (', ' + semMatch.length + ' sem correspondência') : ''));
        render();
      };
      reader.readAsText(file, 'utf-8');
    },
    /* ---- Matrículas ---- */
    'nm-aluno': function (el) { V.novaMatricula.alunoId = el.value; render(); },
    'nm-nome': function (el) { V.novaMatricula.alunoNome = el.value; },
    'nm-turma': function (el) { V.novaMatricula.turmaId = el.value; },
    'nm-data': function (el) { V.novaMatricula.dataInicio = el.value; render(); },
    'nm-data-pagamento': function (el) { V.novaMatricula.dataPagamento = el.value; },
    'nm-pagamento': function (el) { V.novaMatricula.formaPagamento = el.value; },
    'nm-valor-mensalidade': function (el) { V.novaMatricula.valorMensalidade = el.value; },
    'nm-livro': function (el) { V.novaMatricula.livro = el.value; },
    'nm-valor-material': function (el) { V.novaMatricula.valorMaterial = el.value; },
    'nm-desconto-tem': function (el) { V.novaMatricula.descontoTem = el.checked; render(); },
    'nm-desconto-valor': function (el) { V.novaMatricula.descontoValor = el.value; },
    'nm-desconto-obs': function (el) { V.novaMatricula.descontoObs = el.value; },
    'add-matricula': function () {
      const nm = V.novaMatricula;
      const t = D.turmaPorId[nm.turmaId];
      if (!t) { toast('Escolha a turma.'); return; }
      if (!nm.dataInicio) { toast('Escolha a data de início.'); return; }
      let aluno = nm.alunoId ? D.alunoPorId[nm.alunoId] : null;
      if (!aluno) {
        const nome = (nm.alunoNome || '').trim();
        if (!nome) { toast('Informe o nome do aluno ou escolha um já cadastrado.'); return; }
        aluno = {
          id: proxId('al', S.alunos), nome: nome, telefone: '', email: '', turmas: [], formaPagamento: nm.formaPagamento || 'asaas', bolsista: false, cancelado: false, responsavelFinanceiro: '', dataInicio: nm.dataInicio || '',
          pagamento: { status: 'desconhecido', obs: '', atualizadoEm: '', valorEmAberto: '' }, frequencia: {},
          materialDidatico: { enviado: false, data: '', obs: '' }, rematricula: { enviada: false, data: '', obs: '' },
          livroDidatico: { qual: '', comprado: false, mensagemEnviada: false },
          cobranca: { etapa: 0, enviadoEm: '' },
          cancelamento: { solicitado: false, data: '', motivo: '' },
        };
        S.alunos.push(aluno);
      } else {
        aluno.formaPagamento = nm.formaPagamento || aluno.formaPagamento;
      }
      aluno.turmas = aluno.turmas || [];
      if (!aluno.turmas.some(function (x) { return x.turmaId === t.id; })) aluno.turmas.push({ turmaId: t.id, semestre: t.semestre, turma: t.turma });
      t.alunosNomes = t.alunosNomes || [];
      if (!t.alunosNomes.some(function (n) { return L.norm(n) === L.norm(aluno.nome); })) t.alunosNomes.push(aluno.nome);
      if (nm.livro) { aluno.livroDidatico = aluno.livroDidatico || { qual: '', comprado: false, mensagemEnviada: false }; aluno.livroDidatico.qual = nm.livro; }
      const matricula = {
        id: proxId('mat', S.matriculas), alunoId: aluno.id, alunoNome: aluno.nome, turmaId: t.id, turmaNome: t.turma,
        dataInicio: nm.dataInicio, contratoFim: L.fimContrato(nm.dataInicio), dataPagamento: nm.dataPagamento || '',
        formaPagamento: nm.formaPagamento || 'asaas', valorMensalidade: nm.valorMensalidade || '', valorMaterial: nm.valorMaterial || '',
        livro: nm.livro || '', desconto: { tem: !!nm.descontoTem, valor: nm.descontoTem ? (nm.descontoValor || '') : '', obs: nm.descontoTem ? (nm.descontoObs || '') : '' },
        checklist: { sistemaWashington: false, boletoAsaas: false, contratoAssinado: false, materialCobrado: false },
        criadoEm: new Date().toISOString(), criadoPor: autorAtual(),
      };
      S.matriculas.push(matricula);
      LS.set('alunos', S.alunos); LS.set('turmas', S.turmas); LS.set('matriculas', S.matriculas);
      registrar('Registrou matrícula', aluno.nome + ' em ' + t.turma + ' (início ' + nm.dataInicio + ')');
      V.novaMatricula = {
        alunoId: '', alunoNome: '', turmaId: '', dataInicio: '', dataPagamento: '', formaPagamento: 'asaas',
        valorMensalidade: '', valorMaterial: '', livro: '', descontoTem: false, descontoValor: '', descontoObs: '',
      };
      toast('Matrícula registrada e aluno incluído na turma.');
      recalc(); render();
    },
    'chk-matricula': function (el) {
      const m = D.matriculaPorId[el.dataset.id];
      if (!m) return;
      m.checklist[el.dataset.campo] = el.checked;
      LS.set('matriculas', S.matriculas);
      registrar('Atualizou checklist de matrícula', m.alunoNome + ' · ' + el.dataset.campo + ' = ' + el.checked);
      render();
    },
    'livro-matricula': function (el) {
      const m = D.matriculaPorId[el.dataset.id];
      if (m) { m.livro = el.value; LS.set('matriculas', S.matriculas); }
    },
    'editar-matricula': function (el) { dlgEditarMatricula(el.dataset.id); },
    'salvar-matricula': function (el) {
      const m = D.matriculaPorId[el.dataset.id];
      if (!m) return;
      const novaTurmaId = $('#em-turma').value;
      const novaTurma = D.turmaPorId[novaTurmaId];
      const dataInicio = $('#em-data').value;
      if (!novaTurma || !dataInicio) { toast('Escolha a turma e a data de início.'); return; }
      const turmaMudou = novaTurmaId !== m.turmaId;
      if (turmaMudou) {
        const aluno = D.alunoPorId[m.alunoId];
        const turmaAntiga = D.turmaPorId[m.turmaId];
        if (turmaAntiga) turmaAntiga.alunosNomes = (turmaAntiga.alunosNomes || []).filter(function (n) { return L.norm(n) !== L.norm(m.alunoNome); });
        novaTurma.alunosNomes = novaTurma.alunosNomes || [];
        if (!novaTurma.alunosNomes.some(function (n) { return L.norm(n) === L.norm(m.alunoNome); })) novaTurma.alunosNomes.push(m.alunoNome);
        if (aluno) {
          aluno.turmas = (aluno.turmas || []).filter(function (x) { return x.turmaId !== m.turmaId; });
          aluno.turmas.push({ turmaId: novaTurma.id, semestre: novaTurma.semestre, turma: novaTurma.turma });
        }
        LS.set('turmas', S.turmas); LS.set('alunos', S.alunos);
      }
      m.turmaId = novaTurma.id; m.turmaNome = novaTurma.turma;
      m.dataInicio = dataInicio; m.contratoFim = L.fimContrato(dataInicio);
      m.dataPagamento = $('#em-data-pagamento').value || '';
      m.formaPagamento = $('#em-pagamento').value;
      m.valorMensalidade = $('#em-valor-mensalidade').value;
      m.livro = $('#em-livro').value;
      m.valorMaterial = $('#em-valor-material').value;
      const descontoTem = $('#em-desconto-tem').checked;
      m.desconto = { tem: descontoTem, valor: descontoTem ? $('#em-desconto-valor').value : '', obs: descontoTem ? $('#em-desconto-obs').value : '' };
      LS.set('matriculas', S.matriculas);
      registrar('Editou matrícula', m.alunoNome + ' · ' + m.turmaNome);
      toast('Matrícula atualizada.');
      fecharDlg();
      recalc(); render();
    },
    'excluir-matricula': function (el) {
      const m = D.matriculaPorId[el.dataset.id];
      if (!m) return;
      if (typeof confirm === 'function' && !confirm('Excluir esta matrícula de "' + m.alunoNome + '"? Isso não remove o aluno da turma — só apaga o registro/checklist da matrícula. Para tirar o aluno da turma, use "Remover da turma" na ficha da turma.')) return;
      S.matriculas = S.matriculas.filter(function (x) { return x.id !== m.id; });
      LS.set('matriculas', S.matriculas);
      registrar('Excluiu matrícula', m.alunoNome + ' · ' + m.turmaNome);
      render();
    },
    /* ---- Compromissos ---- */
    'nc-titulo': function (el) { V.novoCompromisso.titulo = el.value; },
    'nc-aluno': function (el) { V.novoCompromisso.alunoId = el.value; render(); },
    'nc-nome': function (el) { V.novoCompromisso.alunoNome = el.value; },
    'nc-comquem': function (el) { V.novoCompromisso.comQuem = el.value; },
    'nc-data': function (el) { V.novoCompromisso.data = el.value; },
    'nc-horario': function (el) { V.novoCompromisso.horario = el.value; },
    'nc-local': function (el) { V.novoCompromisso.local = el.value; },
    'nc-obs': function (el) { V.novoCompromisso.obs = el.value; },
    'add-compromisso': function () {
      const nc = V.novoCompromisso;
      if (!nc.titulo || !nc.titulo.trim()) { toast('Dê um título para o compromisso.'); return; }
      if (!nc.data) { toast('Escolha a data.'); return; }
      const aluno = nc.alunoId ? D.alunoPorId[nc.alunoId] : null;
      const compromisso = {
        id: proxId('comp', S.compromissos), titulo: nc.titulo.trim(), alunoId: nc.alunoId || '', alunoNome: aluno ? aluno.nome : (nc.alunoNome || ''),
        comQuem: nc.comQuem || 'Isa', data: nc.data, horario: nc.horario || '', local: nc.local || '', obs: nc.obs || '',
        status: 'agendado', criadoEm: new Date().toISOString(), criadoPor: autorAtual(),
      };
      S.compromissos.push(compromisso);
      LS.set('compromissos', S.compromissos);
      registrar('Agendou compromisso', compromisso.titulo + ' em ' + compromisso.data + (compromisso.horario ? (' ' + compromisso.horario) : ''));
      V.novoCompromisso = { titulo: '', alunoId: '', alunoNome: '', comQuem: 'Isa', data: '', horario: '', local: '', obs: '' };
      toast('Compromisso agendado.');
      recalc(); render();
    },
    'compromisso-status': function (el) {
      const c = D.compromissoPorId[el.dataset.id];
      if (!c) return;
      c.status = el.dataset.st;
      LS.set('compromissos', S.compromissos);
      registrar('Atualizou compromisso', c.titulo + ' · status = ' + c.status);
      render();
    },
    'excluir-compromisso': function (el) {
      const c = D.compromissoPorId[el.dataset.id];
      if (!c) return;
      if (typeof confirm === 'function' && !confirm('Excluir o compromisso "' + c.titulo + '"?')) return;
      S.compromissos = S.compromissos.filter(function (x) { return x.id !== c.id; });
      LS.set('compromissos', S.compromissos);
      registrar('Excluiu compromisso', c.titulo);
      recalc(); render();
    },
    'baixar-ics-compromisso': function (el) {
      const c = D.compromissoPorId[el.dataset.id];
      if (c) L.baixarIcsCompromisso(c);
    },
    /* ---- Frequência ---- */
    'fr-turma': function (el) { V.chamadaTurmaId = el.value; carregarChamadaForm(); render(); },
    'fr-data': function (el) { V.chamadaData = el.value; carregarChamadaForm(); render(); },
    'fr-marcar': function (el) { V.chamadaPresencas[el.dataset.id] = el.dataset.v === 'presente'; render(); },
    'editar-chamada': function (el) { V.chamadaTurmaId = el.dataset.turma; V.chamadaData = el.dataset.data; carregarChamadaForm(); render(); },
    'salvar-chamada': function () {
      if (!V.chamadaTurmaId || !V.chamadaData) { toast('Escolha a turma e a data.'); return; }
      const faltamMarcar = alunosDaTurma(V.chamadaTurmaId).filter(function (a) { return V.chamadaPresencas[a.id] === undefined; });
      if (faltamMarcar.length) { toast('Marque presente ou faltou para todos (faltam ' + faltamMarcar.length + ').'); return; }
      const chave = V.chamadaTurmaId + '|' + V.chamadaData;
      let registro = D.chamadaPorChave[chave];
      const presencas = Object.assign({}, V.chamadaPresencas);
      if (registro) {
        registro.presencas = presencas; registro.atualizadoEm = new Date().toISOString(); registro.criadoPor = autorAtual();
      } else {
        registro = { id: proxId('cham', S.frequencias), turmaId: V.chamadaTurmaId, data: V.chamadaData, presencas: presencas, criadoEm: new Date().toISOString(), criadoPor: autorAtual() };
        S.frequencias.push(registro);
      }
      LS.set('frequencias', S.frequencias);
      registrar('Registrou chamada', (D.turmaPorId[V.chamadaTurmaId] || {}).turma + ' · ' + V.chamadaData);
      toast('Chamada salva.');
      recalc(); render();
    },
    /* ---- Inadimplência ---- */
    'valor-aberto-aluno': function (el) { const a = D.alunoPorId[el.dataset.id]; if (a) { a.pagamento.valorEmAberto = el.value; LS.set('alunos', S.alunos); } },
    'cobranca-etapa': function (el) {
      const a = D.alunoPorId[el.dataset.id];
      if (!a) return;
      a.cobranca = { etapa: Number(el.dataset.et), enviadoEm: new Date().toISOString() };
      LS.set('alunos', S.alunos);
      registrar('Enviou cobrança', a.nome + ' · etapa ' + el.dataset.et);
      render();
    },
    /* ---- Material didático ---- */
    'mat-aluno': function (el) { V.novoMaterial.alunoId = el.value; render(); },
    'mat-nome': function (el) { V.novoMaterial.alunoNome = el.value; },
    'mat-turma': function (el) { V.novoMaterial.turmaNome = el.value; },
    'mat-semestre': function (el) { V.novoMaterial.semestre = el.value; },
    'mat-recebido': function (el) { V.novoMaterial.recebidoEm = el.value; },
    'mat-pago': function (el) { V.novoMaterial.pagoWashington = el.checked; render(); },
    'mat-obs': function (el) { V.novoMaterial.obs = el.value; },
    'add-material': function () {
      const nm = V.novoMaterial;
      const aluno = nm.alunoId ? D.alunoPorId[nm.alunoId] : null;
      const nome = aluno ? aluno.nome : (nm.alunoNome || '').trim();
      if (!nome) { toast('Informe o aluno.'); return; }
      if (!nm.semestre) { toast('Informe o semestre.'); return; }
      const registro = {
        id: proxId('mtl', S.materiais), alunoId: nm.alunoId || '', alunoNome: nome, turmaNome: nm.turmaNome || '', semestre: nm.semestre,
        pagoWashington: !!nm.pagoWashington, recebidoEm: nm.recebidoEm || '', dataEnvio: '', dataEntrega: '', entregue: false, obs: nm.obs || '',
        criadoEm: new Date().toISOString(), criadoPor: autorAtual(),
      };
      S.materiais.push(registro);
      LS.set('materiais', S.materiais);
      registrar('Registrou pedido de material', nome + (registro.turmaNome ? (' · ' + registro.turmaNome) : ''));
      V.novoMaterial = { alunoId: '', alunoNome: '', turmaNome: '', semestre: nm.semestre, pagoWashington: false, recebidoEm: '', dataEnvio: '', dataEntrega: '', entregue: false, obs: '' };
      toast('Pedido de material registrado.');
      render();
    },
    'material-campo': function (el) {
      const m = S.materiais.find(function (x) { return x.id === el.dataset.id; });
      if (!m) return;
      m[el.dataset.campo] = el.value;
      LS.set('materiais', S.materiais);
    },
    'material-toggle': function (el) {
      const m = S.materiais.find(function (x) { return x.id === el.dataset.id; });
      if (!m) return;
      m[el.dataset.campo] = !m[el.dataset.campo];
      LS.set('materiais', S.materiais);
      registrar('Atualizou material didático', m.alunoNome + ' · ' + el.dataset.campo + ' = ' + m[el.dataset.campo]);
      render();
    },
    'excluir-material': function (el) {
      const m = S.materiais.find(function (x) { return x.id === el.dataset.id; });
      if (!m) return;
      if (typeof confirm === 'function' && !confirm('Excluir este registro de material de "' + m.alunoNome + '"?')) return;
      S.materiais = S.materiais.filter(function (x) { return x.id !== m.id; });
      LS.set('materiais', S.materiais);
      registrar('Excluiu registro de material', m.alunoNome);
      render();
    },
    /* ---- Entradas ---- */
    'en-data': function (el) { V.novaEntrada.data = el.value; },
    'en-aluno': function (el) { V.novaEntrada.alunoId = el.value; render(); },
    'en-nome': function (el) { V.novaEntrada.alunoNome = el.value; },
    'en-valor': function (el) { V.novaEntrada.valor = el.value; },
    'en-forma': function (el) { V.novaEntrada.formaPagamento = el.value; },
    'en-referente': function (el) { V.novaEntrada.referente = el.value; },
    'en-obs': function (el) { V.novaEntrada.obs = el.value; },
    'filtro-mes-entradas': function (el) { V.fMesEntradas = el.value; render(); },
    'add-entrada': function () {
      const ne = V.novaEntrada;
      const aluno = ne.alunoId ? D.alunoPorId[ne.alunoId] : null;
      const nome = aluno ? aluno.nome : (ne.alunoNome || '').trim();
      if (!ne.data) { toast('Escolha a data.'); return; }
      if (!ne.valor) { toast('Informe o valor.'); return; }
      const entrada = {
        id: proxId('ent', S.entradas), data: ne.data, alunoId: ne.alunoId || '', alunoNome: nome,
        valor: ne.valor, formaPagamento: ne.formaPagamento || 'Pix', referente: (ne.referente || '').trim(), obs: ne.obs || '',
        criadoEm: new Date().toISOString(), criadoPor: autorAtual(),
      };
      S.entradas.push(entrada);
      LS.set('entradas', S.entradas);
      registrar('Registrou entrada', (nome || '—') + ' · ' + fmtReais(ne.valor) + (entrada.referente ? (' · ' + entrada.referente) : ''));
      V.novaEntrada = { data: ne.data, alunoId: '', alunoNome: '', valor: '', formaPagamento: ne.formaPagamento || 'Pix', referente: '', obs: '' };
      toast('Entrada registrada.');
      render();
    },
    'excluir-entrada': function (el) {
      const e = S.entradas.find(function (x) { return x.id === el.dataset.id; });
      if (!e) return;
      if (typeof confirm === 'function' && !confirm('Excluir esta entrada de "' + (e.alunoNome || '—') + '"?')) return;
      S.entradas = S.entradas.filter(function (x) { return x.id !== e.id; });
      LS.set('entradas', S.entradas);
      registrar('Excluiu entrada', e.alunoNome || '—');
      render();
    },
    /* Corrige a data de um lançamento já registrado (comum quando a equipe lança com atraso). */
    'en-editar-data': function (el) {
      const e = S.entradas.find(function (x) { return x.id === el.dataset.id; });
      if (!e || !el.value) return;
      e.data = el.value;
      LS.set('entradas', S.entradas);
      registrar('Corrigiu data de entrada', (e.alunoNome || '—') + ' → ' + el.value);
      render();
    },
    /* ---- Despesas ---- */
    'de-data': function (el) { V.novaDespesa.data = el.value; },
    'de-descricao': function (el) { V.novaDespesa.descricao = el.value; },
    'de-categoria': function (el) { V.novaDespesa.categoria = el.value; },
    'de-valor': function (el) { V.novaDespesa.valor = el.value; },
    'de-pagopor': function (el) { V.novaDespesa.pagoPor = el.value; },
    'de-pago': function (el) { V.novaDespesa.pago = el.checked; render(); },
    'de-obs': function (el) { V.novaDespesa.obs = el.value; },
    'filtro-mes-despesas': function (el) { V.fMesDespesas = el.value; render(); },
    'add-despesa': function () {
      const nd = V.novaDespesa;
      if (!nd.data) { toast('Escolha a data.'); return; }
      if (!nd.descricao || !nd.descricao.trim()) { toast('Descreva a despesa.'); return; }
      if (!nd.valor) { toast('Informe o valor.'); return; }
      const despesa = {
        id: proxId('des', S.despesas), data: nd.data, descricao: nd.descricao.trim(), categoria: nd.categoria || 'Outro',
        valor: nd.valor, pagoPor: (nd.pagoPor || '').trim(), pago: !!nd.pago, obs: nd.obs || '',
        criadoEm: new Date().toISOString(), criadoPor: autorAtual(),
      };
      S.despesas.push(despesa);
      LS.set('despesas', S.despesas);
      registrar('Registrou despesa', despesa.descricao + ' · ' + fmtReais(nd.valor));
      V.novaDespesa = { data: nd.data, descricao: '', categoria: nd.categoria || 'Custos Fixos', valor: '', pagoPor: '', pago: false, obs: '' };
      toast('Despesa registrada.');
      render();
    },
    'despesa-toggle': function (el) {
      const d = S.despesas.find(function (x) { return x.id === el.dataset.id; });
      if (!d) return;
      d.pago = !d.pago;
      LS.set('despesas', S.despesas);
      registrar('Atualizou despesa', d.descricao + ' · pago = ' + d.pago);
      render();
    },
    'excluir-despesa': function (el) {
      const d = S.despesas.find(function (x) { return x.id === el.dataset.id; });
      if (!d) return;
      if (typeof confirm === 'function' && !confirm('Excluir a despesa "' + d.descricao + '"?')) return;
      S.despesas = S.despesas.filter(function (x) { return x.id !== d.id; });
      LS.set('despesas', S.despesas);
      registrar('Excluiu despesa', d.descricao);
      render();
    },
    /* Corrige a data de uma despesa já registrada (comum quando a equipe lança com atraso). */
    'de-editar-data': function (el) {
      const d = S.despesas.find(function (x) { return x.id === el.dataset.id; });
      if (!d || !el.value) return;
      d.data = el.value;
      LS.set('despesas', S.despesas);
      registrar('Corrigiu data de despesa', d.descricao + ' → ' + el.value);
      render();
    },
    /* ---- Pendências ---- */
    'pend-texto': function (el) { V.novaPendencia.texto = el.value; },
    'pend-aluno': function (el) { V.novaPendencia.alunoId = el.value; },
    'pend-turma': function (el) { V.novaPendencia.turmaId = el.value; },
    'pend-prazo': function (el) { V.novaPendencia.prazo = el.value; },
    'add-pendencia': function () {
      const np = V.novaPendencia;
      if (!np.texto.trim()) { toast('Escreva o que precisa ser feito.'); return; }
      const p = { id: proxId('pend', S.pendencias), texto: np.texto.trim(), alunoId: np.alunoId, turmaId: np.turmaId, prazo: np.prazo, resolvida: false, criadaEm: new Date().toISOString() };
      S.pendencias.push(p);
      LS.set('pendencias', S.pendencias);
      registrar('Criou pendência', p.texto);
      V.novaPendencia = { texto: '', alunoId: '', turmaId: '', prazo: '' };
      render();
    },
    'pendencia-toggle': function (el) {
      const p = S.pendencias.find(function (x) { return x.id === el.dataset.id; });
      if (!p) return;
      p.resolvida = el.checked;
      LS.set('pendencias', S.pendencias);
      registrar('Atualizou pendência', p.texto + ' → ' + (p.resolvida ? 'resolvida' : 'reaberta'));
      render();
    },
    'excluir-pendencia': function (el) {
      const p = S.pendencias.find(function (x) { return x.id === el.dataset.id; });
      if (!p) return;
      S.pendencias = S.pendencias.filter(function (x) { return x.id !== p.id; });
      LS.set('pendencias', S.pendencias);
      registrar('Excluiu pendência', p.texto);
      render();
    },
    'filtro-pendencia': function (el) { V.fPendencia = el.value; render(); },
    /* ---- Comunicados ---- */
    'com-turma': function (el) { V.novoComunicado.turmaId = el.value; },
    'com-mensagem': function (el) { V.novoComunicado.mensagem = el.value; },
    'gerar-comunicado': function () {
      const nc = V.novoComunicado;
      if (!nc.mensagem.trim()) { toast('Escreva a mensagem do comunicado.'); return; }
      const c = { id: proxId('com', S.comunicados), data: HOJE, turmaId: nc.turmaId, mensagem: nc.mensagem.trim(), enviados: {}, criadoEm: new Date().toISOString() };
      S.comunicados.push(c);
      LS.set('comunicados', S.comunicados);
      registrar('Criou comunicado', (c.turmaId ? (D.turmaPorId[c.turmaId] || {}).turma : 'todos') + ' · ' + c.mensagem.slice(0, 60));
      V.novoComunicado = { mensagem: '', turmaId: '' };
      render();
    },
    'comunicado-marcar-enviado': function (el) {
      const c = S.comunicados.find(function (x) { return x.id === el.dataset.com; });
      if (!c) return;
      c.enviados = c.enviados || {};
      c.enviados[el.dataset.aluno] = true;
      LS.set('comunicados', S.comunicados);
      render();
    },
    'excluir-comunicado': function (el) {
      const c = S.comunicados.find(function (x) { return x.id === el.dataset.id; });
      if (!c) return;
      if (typeof confirm === 'function' && !confirm('Excluir este comunicado?')) return;
      S.comunicados = S.comunicados.filter(function (x) { return x.id !== c.id; });
      LS.set('comunicados', S.comunicados);
      registrar('Excluiu comunicado', c.mensagem.slice(0, 60));
      render();
    },
    /* ---- Login ---- */
    'login-email': function (el) { V.loginEmail = el.value; },
    'login-senha': function (el) { V.loginSenha = el.value; },
    'fazer-login': function () {
      if (V.loginCarregando) return;
      const email = (V.loginEmail || '').trim();
      const senha = V.loginSenha || '';
      if (!email || !senha) { V.loginErro = 'Preencha e-mail e senha.'; render(); return; }
      V.loginCarregando = true; V.loginErro = ''; render();
      Sync.signIn(email, senha).catch(function (err) {
        V.loginCarregando = false;
        V.loginErro = Sync.mensagemErroLogin(err);
        render();
      });
      // Se der certo, quem atualiza V.logado e re-renderiza é o watchAuth lá no final do arquivo.
    },
    sair: function () { Sync.signOut(); }
  };

  document.addEventListener('click', function (e) {
    const el = e.target.closest('[data-act]');
    if (!el || !ACTS[el.dataset.act]) return;
    const tag = el.tagName;
    // <select>, campos de texto/data e <textarea> já são tratados pelos eventos 'input'/'change' logo
    // abaixo. Interceptar o clique neles (e cancelar o padrão do navegador) é o que fazia a lista,
    // o calendário ou o seletor de arquivo não abrirem de primeira — exigindo "apertar forte"/tocar
    // de novo. Checkbox e radio continuam passando por aqui, pois são eles que disparam a ação.
    if (tag === 'SELECT' || tag === 'TEXTAREA' || (tag === 'INPUT' && el.type !== 'checkbox' && el.type !== 'radio')) return;
    if (tag === 'A' || (tag === 'INPUT' && (el.type === 'checkbox' || el.type === 'radio'))) {
      /* deixa o navegador fazer o padrão (abrir o link, marcar/desmarcar a caixinha) e ainda roda a ação */
    } else {
      e.preventDefault();
    }
    ACTS[el.dataset.act](el);
  });
  document.addEventListener('change', function (e) {
    const el = e.target.closest('[data-act]');
    if (el && ACTS[el.dataset.act] && (el.tagName === 'SELECT' || el.type === 'file')) ACTS[el.dataset.act](el);
  });
  document.addEventListener('input', function (e) {
    const el = e.target.closest('[data-act]');
    if (el && ACTS[el.dataset.act] && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.type !== 'file'))) ACTS[el.dataset.act](el);
  });
  document.addEventListener('click', function (e) {
    const navBtn = e.target.closest('.nav-item');
    if (navBtn) { V.view = navBtn.dataset.view; render(); }
  });
  document.addEventListener('submit', function (e) {
    if (e.target.tagName !== 'FORM') return;
    e.preventDefault();
    const btn = e.target.querySelector('[data-act]');
    if (btn && ACTS[btn.dataset.act]) ACTS[btn.dataset.act](btn);
  });

  /* ---------- Sincronização entre navegadores ---------- */
  function aplicarRemoto(dados) {
    let mudou = false;
    ['professores', 'turmas', 'alunos', 'matriculas', 'compromissos', 'frequencias', 'cfg', 'log', 'asaasImportado', 'materiais', 'entradas', 'despesas', 'pendencias', 'comunicados'].forEach(function (k) {
      if (dados[k] !== undefined) {
        S[k] = dados[k];
        if (k === 'alunos') normalizarAlunos(S.alunos);
        LS.setLocal(k, S[k]);
        mudou = true;
      }
    });
    if (mudou) { recalc(); render(); }
  }
  recalc();

  function estadoAtualParaSemear() {
    return { professores: S.professores, turmas: S.turmas, alunos: S.alunos, matriculas: S.matriculas, compromissos: S.compromissos, frequencias: S.frequencias, cfg: S.cfg, log: S.log, asaasImportado: S.asaasImportado, materiais: S.materiais, entradas: S.entradas, despesas: S.despesas, pendencias: S.pendencias, comunicados: S.comunicados };
  }

  let syncIniciado = false;
  function iniciarSyncSeNecessario() {
    if (syncIniciado) return;
    syncIniciado = true;
    Sync.init(aplicarRemoto, function (status) { V.syncStatus = status; if ($('#app')) render(); }, estadoAtualParaSemear);
  }

  if (!Sync.configured()) {
    render();
  } else {
    render(); // mostra a tela de login enquanto o Firebase confere se já está logada
    Sync.watchAuth(function (user) {
      V.logado = !!user;
      V.authEmail = user ? (user.email || '') : '';
      V.loginCarregando = false;
      if (user) { V.loginEmail = ''; V.loginSenha = ''; V.loginErro = ''; iniciarSyncSeNecessario(); }
      render();
    });
  }
})();

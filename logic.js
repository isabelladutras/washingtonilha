/* Lógica do painel acadêmico · Washington Ilha
   --------------------------------------------------
   Ao contrário do Polo 1740 (calendário com datas específicas de um mês), aqui as turmas são
   aulas semanais recorrentes (ex.: "SEG/QUA 18h-19h"), então a "grade" é por dia da semana +
   horário, sem mês/ano.
*/
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.L = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DIAS_ORDEM = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];
  const DIAS_FULL = { SEG: 'Segunda', TER: 'Terça', QUA: 'Quarta', QUI: 'Quinta', SEX: 'Sexta', 'SÁB': 'Sábado', DOM: 'Domingo' };

  function norm(s) {
    return String(s || '').normalize('NFD').replace(/\p{Mark}/gu, '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  /** "SEG/QUA" -> ["SEG","QUA"], "TER/QUI" -> ["TER","QUI"], "SÁB" -> ["SÁB"] etc. */
  function diasDaTurma(diaTxt) {
    return String(diaTxt || '').split('/').map(function (s) { return s.trim().toUpperCase(); }).filter(Boolean);
  }

  /** Extrai [horaIni, horaFim] em minutos desde meia-noite, a partir de "18h - 19h" / "9:45h - 11h" etc. */
  function horarioMin(horarioTxt) {
    const partes = String(horarioTxt || '').split('-');
    if (partes.length < 2) return null;
    function paraMin(txt) {
      const m = txt.match(/(\d{1,2})(?::(\d{2}))?/);
      if (!m) return null;
      return parseInt(m[1], 10) * 60 + (m[2] ? parseInt(m[2], 10) : 0);
    }
    const ini = paraMin(partes[0]), fim = paraMin(partes[1]);
    if (ini == null || fim == null) return null;
    return [ini, fim];
  }

  function horariosSeSobrepoem(h1, h2) {
    if (!h1 || !h2) return false;
    return h1[0] < h2[1] && h2[0] < h1[1];
  }

  /** Lista de turmas agrupadas por dia da semana, na ordem SEG..DOM, prontas pra grade semanal. */
  function gradeSemanal(turmas) {
    const porDia = {};
    DIAS_ORDEM.forEach(function (d) { porDia[d] = []; });
    turmas.forEach(function (t) {
      diasDaTurma(t.dia).forEach(function (d) {
        if (!porDia[d]) porDia[d] = [];
        porDia[d].push(t);
      });
    });
    DIAS_ORDEM.forEach(function (d) {
      porDia[d].sort(function (a, b) {
        const ha = horarioMin(a.horario), hb = horarioMin(b.horario);
        return (ha ? ha[0] : 0) - (hb ? hb[0] : 0);
      });
    });
    return porDia;
  }

  /**
   * Conflitos de sala/professor: duas turmas no mesmo dia da semana com horário sobreposto.
   * Importante: só compara turmas do MESMO semestre — 2026.1 e 2026.2 não acontecem ao mesmo
   * tempo, então uma turma de cada não é um choque real de agenda.
   */
  function conferirConflitos(turmas) {
    const avisos = [];
    const porDiaSemestre = {};
    turmas.forEach(function (t) {
      diasDaTurma(t.dia).forEach(function (d) {
        const chave = (t.semestre || '') + '|' + d;
        (porDiaSemestre[chave] = porDiaSemestre[chave] || []).push(t);
      });
    });
    Object.keys(porDiaSemestre).forEach(function (chave) {
      const d = chave.split('|')[1];
      const lista = porDiaSemestre[chave];
      for (let i = 0; i < lista.length; i++) {
        for (let j = i + 1; j < lista.length; j++) {
          const a = lista[i], b = lista[j];
          const ha = horarioMin(a.horario), hb = horarioMin(b.horario);
          if (!horariosSeSobrepoem(ha, hb)) continue;
          if (a.professor && b.professor && norm(a.professor) === norm(b.professor)) {
            avisos.push({
              tipo: 'professor', dia: d, chave: ['prof', a.semestre, d, a.id, b.id].join('|'),
              msg: 'Choque de professor (' + a.semestre + '): ' + a.professor + ' tem "' + a.turma + '" (' + a.horario + ') e "' + b.turma + '" (' + b.horario + ') em ' + DIAS_FULL[d] + '.',
              turmas: [a.id, b.id],
            });
          }
          if (a.sala && b.sala && norm(a.sala) === norm(b.sala) && !/online/i.test(a.sala)) {
            avisos.push({
              tipo: 'sala', dia: d, chave: ['sala', a.semestre, d, a.id, b.id].join('|'),
              msg: 'Choque de sala (' + a.sala + ', ' + a.semestre + '): "' + a.turma + '" (' + a.professor + ', ' + a.horario + ') e "' + b.turma + '" (' + b.professor + ', ' + b.horario + ') em ' + DIAS_FULL[d] + '.',
              turmas: [a.id, b.id],
            });
          }
        }
      }
    });
    turmas.forEach(function (t) {
      if (!t.sala && !/online/i.test(t.turma || '') && t.situacao && /andamento/i.test(t.situacao)) {
        avisos.push({
          tipo: 'sem-sala', dia: '', chave: ['sem-sala', t.id].join('|'),
          msg: 'Sem sala definida: "' + t.turma + '" (' + t.professor + ', ' + t.dia + ' ' + t.horario + ', ' + t.semestre + ').',
          turmas: [t.id],
        });
      }
    });
    return avisos;
  }

  /** Junta nomes de forma natural: "A", "A e B", "A, B e C". */
  function juntarNatural(lista) {
    const l = (lista || []).filter(Boolean);
    if (l.length <= 1) return l.join('');
    if (l.length === 2) return l.join(' e ');
    return l.slice(0, -1).join(', ') + ' e ' + l[l.length - 1];
  }

  // ---------------- Matrícula e contrato semestral ----------------

  /**
   * O contrato é sempre semestral: começa em qualquer dia e termina em 30/06 (se começou entre
   * janeiro e junho) ou 31/12 (se começou entre julho e dezembro) do mesmo ano.
   */
  function fimContrato(dataInicioISO) {
    const d = new Date(dataInicioISO + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    const ano = d.getFullYear(), mes = d.getMonth() + 1; // 1-12
    return mes <= 6 ? (ano + '-06-30') : (ano + '-12-31');
  }

  /** Dias entre hoje e uma data ISO (negativo se já passou). */
  function diasAte(dataISO, hojeISO) {
    const hoje = new Date((hojeISO || new Date().toISOString().slice(0, 10)) + 'T00:00:00');
    const alvo = new Date(dataISO + 'T00:00:00');
    if (isNaN(alvo.getTime())) return null;
    return Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
  }

  /** '2026.1' (jan-jun) ou '2026.2' (jul-dez), a partir de uma data ISO. */
  function semestreDeData(dataISO) {
    const d = new Date(dataISO + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    const ano = d.getFullYear(), mes = d.getMonth() + 1;
    return ano + (mes <= 6 ? '.1' : '.2');
  }

  function pad2Data(n) { return (n < 10 ? '0' : '') + n; }
  function isoDeData(d) { return d.getFullYear() + '-' + pad2Data(d.getMonth() + 1) + '-' + pad2Data(d.getDate()); }

  /** Soma (ou subtrai, com n negativo) dias a uma data ISO, devolvendo outra data ISO. */
  function somaDias(dataISO, n) {
    const d = new Date(dataISO + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return isoDeData(d);
  }

  /** Segunda-feira da semana de uma data ISO (ou de hoje, se omitida). */
  function segundaDaSemana(dataISO) {
    const d = new Date((dataISO || new Date().toISOString().slice(0, 10)) + 'T00:00:00');
    const diaSemana = (d.getDay() + 6) % 7; // 0=SEG .. 6=DOM
    d.setDate(d.getDate() - diaSemana);
    return isoDeData(d);
  }

  /** "dd/mm" a partir de uma data ISO. */
  function fmtCurta(dataISO) {
    const d = new Date(dataISO + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    return pad2Data(d.getDate()) + '/' + pad2Data(d.getMonth() + 1);
  }

  // ---------------- Mensagens de WhatsApp (botão "preparar e revisar") ----------------

  function telefoneParaWhatsApp(tel) {
    const digitos = String(tel || '').replace(/\D/g, '');
    if (!digitos) return '';
    return digitos.length <= 11 ? '55' + digitos : digitos;
  }

  function linkWhatsApp(telefone, mensagem) {
    const num = telefoneParaWhatsApp(telefone);
    const texto = encodeURIComponent(mensagem || '');
    return num ? ('https://wa.me/' + num + '?text=' + texto) : ('https://wa.me/?text=' + texto);
  }

  function mensagemRematricula(aluno, turma) {
    const primeiroNome = String(aluno.nome || '').split(' ')[0];
    return 'Olá, ' + primeiroNome + '! Aqui é da Washington Ilha. 😊\n\n' +
      'Está chegando a hora da rematrícula da turma "' + (turma ? turma.turma : '') + '" para o próximo semestre. ' +
      'Quer que a gente já garanta sua vaga no mesmo horário (' + (turma ? (turma.dia + ' ' + turma.horario) : '') + ')?\n\n' +
      'Qualquer dúvida sobre valores ou datas, me conta por aqui mesmo!';
  }

  function mensagemMaterialDidatico(aluno, turma, livro) {
    const primeiroNome = String(aluno.nome || '').split(' ')[0];
    const livroTxt = livro ? ('o livro "' + livro + '"') : 'o material didático';
    return 'Olá, ' + primeiroNome + '! Aqui é da Washington Ilha. 📚\n\n' +
      'Passando para avisar que, para a turma "' + (turma ? turma.turma : '') + '", você precisa comprar ' + livroTxt + '. ' +
      'Me avisa se precisar de alguma orientação para conseguir o material!';
  }

  /** etapa 1 = lembrete amigável (padrão), 2 = segundo aviso, 3+ = aviso final. */
  function mensagemCobranca(aluno, etapa) {
    const primeiroNome = String(aluno.nome || '').split(' ')[0];
    const et = etapa || 1;
    if (et >= 3) {
      return 'Olá, ' + primeiroNome + '! Aqui é da Washington Ilha.\n\n' +
        'Essa é nossa última tentativa de contato sobre a mensalidade em aberto. Pedimos a regularização nos próximos dias para evitar a suspensão das aulas. ' +
        'Se já pagou, me manda o comprovante por aqui que eu confirmo. Qualquer dificuldade, nos avisa que a gente conversa.';
    }
    if (et === 2) {
      return 'Olá, ' + primeiroNome + '! Aqui é da Washington Ilha.\n\n' +
        'Reforçando: ainda consta uma mensalidade pendente. Pode verificar e regularizar quando possível? ' +
        'Se já tiver pago, me manda o comprovante por aqui que eu confirmo. Obrigada!';
    }
    return 'Olá, ' + primeiroNome + '! Aqui é da Washington Ilha.\n\n' +
      'Estamos com uma pendência referente à mensalidade. Pode verificar e regularizar quando possível? ' +
      'Se já tiver pago, pode me mandar o comprovante por aqui que eu confirmo. Obrigada!';
  }

  // ---------------- Calendário (.ics) — só "adicionar à agenda", sem sincronização de via dupla ----------------

  /** Próxima data (a partir de hoje) em que a turma tem aula, para um dos dias da semana dela. */
  function proximaData(diaSemana, aPartirDe) {
    const idxAlvo = DIAS_ORDEM.indexOf(diaSemana);
    if (idxAlvo < 0) return null;
    const base = aPartirDe ? new Date(aPartirDe) : new Date();
    base.setHours(0, 0, 0, 0);
    // getDay(): 0=domingo..6=sábado; nosso DIAS_ORDEM é SEG..DOM
    const hojeIdx = (base.getDay() + 6) % 7; // 0=SEG .. 6=DOM
    let diff = idxAlvo - hojeIdx;
    if (diff < 0) diff += 7;
    const d = new Date(base);
    d.setDate(d.getDate() + diff);
    return d;
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function icsDataHora(data, minutosDoDia) {
    const d = new Date(data);
    const h = Math.floor(minutosDoDia / 60), m = minutosDoDia % 60;
    return '' + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + 'T' + pad2(h) + pad2(m) + '00';
  }

  /** Gera um .ics com um evento recorrente (RRULE semanal) por dia da semana da turma. */
  function icsTurma(turma) {
    const dias = diasDaTurma(turma.dia);
    const hm = horarioMin(turma.horario);
    const RRULE_DIA = { SEG: 'MO', TER: 'TU', QUA: 'WE', QUI: 'TH', SEX: 'FR', 'SÁB': 'SA', DOM: 'SU' };
    const linhas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Washington Ilha//Painel//PT-BR', 'CALSCALE:GREGORIAN'];
    dias.forEach(function (d, i) {
      const prox = proximaData(d);
      if (!prox || !hm) return;
      const uid = turma.id + '-' + d + '@academiawashington';
      linhas.push('BEGIN:VEVENT');
      linhas.push('UID:' + uid);
      linhas.push('DTSTAMP:' + icsDataHora(new Date(), 0));
      linhas.push('DTSTART:' + icsDataHora(prox, hm[0]));
      linhas.push('DTEND:' + icsDataHora(prox, hm[1]));
      if (RRULE_DIA[d]) linhas.push('RRULE:FREQ=WEEKLY;BYDAY=' + RRULE_DIA[d]);
      linhas.push('SUMMARY:' + (turma.turma || 'Aula') + ' — ' + (turma.professor || ''));
      linhas.push('DESCRIPTION:Turma ' + (turma.turma || '') + (turma.sala ? (' · Sala ' + turma.sala) : '') + ' · Professor(a) ' + (turma.professor || ''));
      if (turma.sala) linhas.push('LOCATION:' + turma.sala);
      linhas.push('END:VEVENT');
    });
    linhas.push('END:VCALENDAR');
    return linhas.join('\r\n');
  }

  function baixarIcsTurma(turma) {
    const conteudo = icsTurma(turma);
    const blob = new Blob([conteudo], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'aula-' + norm(turma.turma).replace(/\s+/g, '-') + '-' + norm(turma.dia).replace(/\s+/g, '-') + '.ics';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  /** "segunda-feira, 05/10/2026" a partir de uma data ISO. */
  function fmtLonga(dataISO) {
    const d = new Date(dataISO + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    const NOMES = { SEG: 'segunda-feira', TER: 'terça-feira', QUA: 'quarta-feira', QUI: 'quinta-feira', SEX: 'sexta-feira', 'SÁB': 'sábado', DOM: 'domingo' };
    const idx = (d.getDay() + 6) % 7;
    return NOMES[DIAS_ORDEM[idx]] + ', ' + pad2Data(d.getDate()) + '/' + pad2Data(d.getMonth() + 1) + '/' + d.getFullYear();
  }

  /** Converte "14h30", "14:30", "14h" em minutos desde meia-noite (ou null se não der pra entender). */
  function horaParaMin(horaTxt) {
    const m = String(horaTxt || '').match(/(\d{1,2})[h:]?(\d{2})?/);
    if (!m) return null;
    const h = Number(m[1]), min = m[2] ? Number(m[2]) : 0;
    if (isNaN(h) || h > 23) return null;
    return h * 60 + min;
  }

  /** Gera um .ics com um único evento (não recorrente) para um compromisso numa data/hora específica. */
  function icsCompromisso(c) {
    const min = horaParaMin(c.horario);
    const dataHora = new Date((c.data || '') + 'T00:00:00');
    if (isNaN(dataHora.getTime())) return '';
    const inicioMin = min == null ? 9 * 60 : min;
    const uid = 'compromisso-' + (c.id || Date.now()) + '@academiawashington';
    const linhas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Washington Ilha//Painel//PT-BR', 'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT', 'UID:' + uid, 'DTSTAMP:' + icsDataHora(new Date(), 0),
      'DTSTART:' + icsDataHora(dataHora, inicioMin), 'DTEND:' + icsDataHora(dataHora, inicioMin + 30),
      'SUMMARY:' + (c.titulo || 'Compromisso') + (c.comQuem ? (' — ' + c.comQuem) : ''),
      'DESCRIPTION:' + (c.obs || '').replace(/\r?\n/g, ' '),
    ];
    if (c.local) linhas.push('LOCATION:' + c.local);
    linhas.push('END:VEVENT', 'END:VCALENDAR');
    return linhas.join('\r\n');
  }

  function baixarIcsCompromisso(c) {
    const conteudo = icsCompromisso(c);
    if (!conteudo) return;
    const blob = new Blob([conteudo], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'compromisso-' + norm(c.titulo || 'evento').replace(/\s+/g, '-') + '-' + (c.data || '') + '.ics';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  function mensagemConfirmacaoCompromisso(c, nomeResponsavel) {
    const primeiroNome = String(nomeResponsavel || '').split(' ')[0];
    const saud = primeiroNome ? ('Olá, ' + primeiroNome + '! ') : 'Olá! ';
    return saud + 'Aqui é da Washington Ilha. 📅\n\n' +
      'Confirmando nosso compromisso: "' + (c.titulo || '') + '", ' + fmtLonga(c.data) + (c.horario ? (' às ' + c.horario) : '') + (c.local ? (', em ' + c.local) : '') + '.\n\n' +
      'Qualquer imprevisto, me avisa por aqui que a gente reagenda!';
  }

  // ---------------- Frequência (chamada por turma/aula) ----------------

  /** Código do dia da semana (SEG..DOM) de uma data ISO. */
  function diaDaSemana(dataISO) {
    const d = new Date(dataISO + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    return DIAS_ORDEM[(d.getDay() + 6) % 7];
  }

  /** Resume as chamadas (lista de {presencas:{alunoId:bool}}) para um aluno: total, presenças, faltas, % presença. */
  function resumoFrequencia(chamadas, alunoId) {
    let total = 0, presencas = 0;
    (chamadas || []).forEach(function (c) {
      if (c.presencas && Object.prototype.hasOwnProperty.call(c.presencas, alunoId)) {
        total++;
        if (c.presencas[alunoId]) presencas++;
      }
    });
    const pct = total ? Math.round((presencas / total) * 100) : null;
    return { total: total, presencas: presencas, faltas: total - presencas, pct: pct };
  }

  // ---------------- Importação de relatório do Asaas (pagamentos) ----------------

  /**
   * Faz o parse de um CSV exportado do Asaas (relatório de cobranças). Aceita nomes de coluna
   * em variações comuns (cliente/nome, status, vencimento/data, valor). Devolve uma lista de
   * {nome, status, vencimento, valor} — o pareamento com o aluno é feito por nome (normalizado)
   * na camada do app.js, porque o Asaas não compartilha nenhum ID com esta planilha de turmas.
   */
  function parseAsaasCSV(texto) {
    const linhas = String(texto || '').split(/\r?\n/).filter(function (l) { return l.trim(); });
    if (!linhas.length) return [];
    const sep = linhas[0].indexOf(';') > -1 && linhas[0].indexOf(';') < linhas[0].indexOf(',') ? ';' : ',';
    const cab = linhas[0].split(sep).map(function (h) { return norm(h); });
    function col(nomes) {
      for (let i = 0; i < cab.length; i++) if (nomes.indexOf(cab[i]) > -1) return i;
      return -1;
    }
    const iNome = col(['cliente', 'nome', 'nome do cliente', 'pagador']);
    const iStatus = col(['status', 'situacao']);
    const iVenc = col(['vencimento', 'data de vencimento', 'data vencimento']);
    const iValor = col(['valor', 'valor (r$)', 'valor cobranca']);
    // No Asaas o boleto quase sempre sai no nome de quem paga (responsável/pai), não no nome do
    // aluno — mas o nome do aluno costuma aparecer na descrição/histórico da cobrança. Pegamos
    // essa coluna também (quando existir) para o app.js tentar casar por ela como 2ª tentativa.
    const iDescricao = col(['descricao', 'descrição', 'historico', 'histórico', 'observacoes', 'observações', 'referencia', 'referência']);
    if (iNome < 0) return [];
    const out = [];
    for (let i = 1; i < linhas.length; i++) {
      const cols = linhas[i].split(sep);
      const nome = (cols[iNome] || '').trim();
      if (!nome) continue;
      out.push({
        nome: nome,
        status: iStatus > -1 ? (cols[iStatus] || '').trim() : '',
        vencimento: iVenc > -1 ? (cols[iVenc] || '').trim() : '',
        valor: iValor > -1 ? (cols[iValor] || '').trim() : '',
        descricao: iDescricao > -1 ? (cols[iDescricao] || '').trim() : '',
      });
    }
    return out;
  }

  /** Classifica o texto de status do Asaas em 'em dia' | 'atrasado' | 'desconhecido'. */
  function statusPagamento(txtStatus) {
    const t = norm(txtStatus);
    if (/recebid|confirmad|pago/.test(t)) return 'em dia';
    if (/vencid|atrasad|overdue/.test(t)) return 'atrasado';
    if (/pendente|aguardando/.test(t)) return 'pendente';
    return 'desconhecido';
  }

  return {
    DIAS_ORDEM: DIAS_ORDEM, DIAS_FULL: DIAS_FULL,
    norm: norm, diasDaTurma: diasDaTurma, horarioMin: horarioMin, horariosSeSobrepoem: horariosSeSobrepoem,
    gradeSemanal: gradeSemanal, conferirConflitos: conferirConflitos, juntarNatural: juntarNatural,
    fimContrato: fimContrato, diasAte: diasAte, semestreDeData: semestreDeData,
    somaDias: somaDias, segundaDaSemana: segundaDaSemana, fmtCurta: fmtCurta, fmtLonga: fmtLonga, horaParaMin: horaParaMin,
    telefoneParaWhatsApp: telefoneParaWhatsApp, linkWhatsApp: linkWhatsApp,
    mensagemRematricula: mensagemRematricula, mensagemMaterialDidatico: mensagemMaterialDidatico, mensagemCobranca: mensagemCobranca,
    mensagemConfirmacaoCompromisso: mensagemConfirmacaoCompromisso,
    proximaData: proximaData, icsTurma: icsTurma, baixarIcsTurma: baixarIcsTurma,
    icsCompromisso: icsCompromisso, baixarIcsCompromisso: baixarIcsCompromisso,
    diaDaSemana: diaDaSemana, resumoFrequencia: resumoFrequencia,
    parseAsaasCSV: parseAsaasCSV, statusPagamento: statusPagamento,
  };
});

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

  /**
   * Dias de atraso a partir de um "dia de vencimento" mensal (1-31) e a data de hoje. Acha o
   * vencimento mais recente que já passou (deste mês, ou do mês anterior se o dia deste mês
   * ainda não chegou) e devolve a diferença em dias. Devolve null se o dia de vencimento não
   * for um número válido. Usado só como sugestão (não decide nada sozinho).
   */
  function diasEmAtraso(diaVencimento, hojeISO) {
    const dia = parseInt(diaVencimento, 10);
    if (!dia || dia < 1 || dia > 31) return null;
    const hoje = new Date((hojeISO || new Date().toISOString().slice(0, 10)) + 'T00:00:00');
    function ultimoDiaDoMes(ano, mesZeroBased) { return new Date(ano, mesZeroBased + 1, 0).getDate(); }
    function candidato(ano, mesZeroBased) {
      return new Date(ano, mesZeroBased, Math.min(dia, ultimoDiaDoMes(ano, mesZeroBased)));
    }
    let c = candidato(hoje.getFullYear(), hoje.getMonth());
    if (c.getTime() > hoje.getTime()) {
      let mes = hoje.getMonth() - 1, ano = hoje.getFullYear();
      if (mes < 0) { mes = 11; ano--; }
      c = candidato(ano, mes);
    }
    return Math.round((hoje.getTime() - c.getTime()) / 86400000);
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

  /** Dias até o próximo aniversário (dia/mês de dataNascimentoISO), a partir de hojeISO — sempre
      >= 0, contando o próximo que ainda vai acontecer (já vira pro ano seguinte se o dia/mês já
      passou este ano). Devolve null se a data de nascimento não for válida. */
  function diasAteAniversario(dataNascimentoISO, hojeISO) {
    const nasc = new Date((dataNascimentoISO || '') + 'T00:00:00');
    if (isNaN(nasc.getTime())) return null;
    const hoje = new Date((hojeISO || new Date().toISOString().slice(0, 10)) + 'T00:00:00');
    let prox = new Date(hoje.getFullYear(), nasc.getMonth(), nasc.getDate());
    if (prox.getTime() < hoje.getTime()) prox = new Date(hoje.getFullYear() + 1, nasc.getMonth(), nasc.getDate());
    return Math.round((prox.getTime() - hoje.getTime()) / 86400000);
  }

  function mensagemAniversario(aluno) {
    const primeiroNome = String(aluno.nome || '').split(' ')[0];
    return 'Parabéns, ' + primeiroNome + '! 🎉🎂\n\n' +
      'A equipe da Washington Ilha deseja um feliz aniversário pra você! Que seu novo ciclo venha cheio de conquistas. 😊';
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

  /* ---------- Ponto digital dos professores ----------
     Cada batida (entrada ou saída) vira um registro { id, profId, profNome, turma, turmaId, tipo,
     em } — `em` em milissegundos. As funções abaixo juntam as batidas em aulas e somam o tempo.
     Ficam aqui (sem depender da tela) pra poderem ser testadas sozinhas. */

  /** "Luciano Sartori" -> "luciano-sartori" (identificador estável do professor no ponto). */
  function pontoSlug(nome) {
    return norm(nome).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  /** 1672 -> "27h52"; 50 -> "0h50". */
  function fmtHM(min) {
    const m = Math.max(0, Math.round(Number(min) || 0));
    return Math.floor(m / 60) + 'h' + String(m % 60).padStart(2, '0');
  }

  /** Data local AAAA-MM-DD e hora HH:MM de um instante em milissegundos. */
  function dataLocal(ms) { return isoDeData(new Date(ms)); }
  function horaLocal(ms) { const d = new Date(ms); return pad2Data(d.getHours()) + ':' + pad2Data(d.getMinutes()); }

  /**
   * Período de fechamento da folha de ponto: do dia (corte + 1) de um mês até o dia `corte` do
   * mês seguinte — ex.: corte 20 → 21/09 a 20/10. `refISO` é qualquer dia dentro do período
   * desejado; `deslocamento` anda N períodos pra frente/trás.
   * Devolve { ini, fim } (AAAA-MM-DD, os dois inclusive) e `competencia` (AAAA-MM do início,
   * que é o mês escrito no cabeçalho da folha — "Controle de aula setembro" = 21/09 a 20/10).
   */
  function periodoFechamento(refISO, diaCorte, deslocamento) {
    const corte = Math.min(28, Math.max(1, parseInt(diaCorte, 10) || 20));
    const p = String(refISO).split('-').map(Number);
    let ano = p[0], mes = p[1]; // mês (1-12) em que o período COMEÇA
    if (p[2] <= corte) { mes -= 1; if (mes < 1) { mes = 12; ano -= 1; } }
    mes += (deslocamento || 0);
    while (mes < 1) { mes += 12; ano -= 1; }
    while (mes > 12) { mes -= 12; ano += 1; }
    let anoFim = ano, mesFim = mes + 1;
    if (mesFim > 12) { mesFim = 1; anoFim += 1; }
    return {
      ini: ano + '-' + pad2Data(mes) + '-' + pad2Data(corte + 1),
      fim: anoFim + '-' + pad2Data(mesFim) + '-' + pad2Data(corte),
      competencia: ano + '-' + pad2Data(mes),
    };
  }

  /**
   * Junta as batidas em aulas. Regras:
   * - entrada abre uma aula; a próxima saída do MESMO dia fecha essa aula;
   * - duas entradas seguidas → a primeira fica pendente ("sem saída");
   * - saída sem entrada aberta → pendente ("sem entrada");
   * - entrada que ficou aberta no fim: se for de hoje, é "em aula agora"; senão, "sem saída".
   * Devolve um objeto por profId: { profId, profNome, aulas: [...], pendentes: [...], totalMin }.
   * Cada aula: { data, entrada, saida, turma, turmaId, min }. Cada pendente: { motivo, reg }.
   */
  function parearPonto(registros, hojeISO) {
    const porProf = {};
    (registros || []).slice().sort(function (a, b) { return a.em - b.em; }).forEach(function (r) {
      if (!r || !r.profId || !(r.em > 0)) return;
      const g = porProf[r.profId] || (porProf[r.profId] = { profId: r.profId, profNome: r.profNome || r.profId, regs: [] });
      if (r.profNome) g.profNome = r.profNome;
      g.regs.push(r);
    });
    const out = {};
    Object.keys(porProf).forEach(function (pid) {
      const g = porProf[pid];
      const aulas = [], pendentes = [], emAula = [];
      let aberta = null;
      function fecharPendente(motivo) { if (aberta) { pendentes.push({ motivo: motivo, reg: aberta }); aberta = null; } }
      g.regs.forEach(function (r) {
        if (r.tipo === 'entrada') {
          fecharPendente('sem saída');
          aberta = r;
        } else if (r.tipo === 'saida') {
          if (aberta && dataLocal(aberta.em) === dataLocal(r.em)) {
            aulas.push({
              data: dataLocal(aberta.em), entrada: aberta, saida: r,
              turma: aberta.turma || r.turma || '', turmaId: aberta.turmaId || r.turmaId || '',
              min: Math.round((r.em - aberta.em) / 60000),
            });
            aberta = null;
          } else {
            fecharPendente('sem saída');
            pendentes.push({ motivo: 'sem entrada', reg: r });
          }
        }
      });
      if (aberta) {
        if (hojeISO && dataLocal(aberta.em) === hojeISO) emAula.push(aberta);
        else fecharPendente('sem saída');
      }
      out[pid] = {
        profId: pid, profNome: g.profNome, aulas: aulas, pendentes: pendentes, emAula: emAula,
        totalMin: aulas.reduce(function (s, a) { return s + a.min; }, 0),
      };
    });
    return out;
  }

  /**
   * Compara uma aula batida com o horário cadastrado da turma ("18h - 19:15h"). Devolve
   * { atrasoMin, saidaCedoMin, extraMin } — só os valores acima da tolerância (em minutos),
   * ou null se a turma não tiver horário reconhecível.
   */
  function compararComHorario(aula, horarioTxt, tolerancia) {
    const hm = horarioMin(horarioTxt);
    if (!hm || !aula || !aula.entrada || !aula.saida) return null;
    const tol = tolerancia == null ? 5 : tolerancia;
    const e = new Date(aula.entrada.em), s = new Date(aula.saida.em);
    const eMin = e.getHours() * 60 + e.getMinutes(), sMin = s.getHours() * 60 + s.getMinutes();
    const atraso = eMin - hm[0], cedo = hm[1] - sMin, extra = sMin - hm[1];
    return {
      atrasoMin: atraso > tol ? atraso : 0,
      saidaCedoMin: cedo > tol ? cedo : 0,
      extraMin: extra > tol ? extra : 0,
    };
  }

  /* ---------- Relatório de cobranças do Asaas (.xlsx ou .csv) → entradas, situação e pendências ----------
     O app.js lê a planilha (com a biblioteca SheetJS) e entrega aqui uma lista de objetos com as
     colunas do Asaas. Tudo daqui pra baixo é cálculo puro (sem tela), pra poder ser testado. */
  function asaasData(v) {
    if (v == null || v === '') return '';
    if (typeof v === 'number') return new Date(Math.round((v - 25569) * 864e5)).toISOString().slice(0, 10);
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    const s = String(v).trim();
    let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
    if (m) return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
    m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    return m ? m[0] : '';
  }
  function asaasNumero(v) {
    if (typeof v === 'number') return v;
    const s = String(v == null ? '' : v).replace(/[R$\s]/g, '');
    if (!s) return 0;
    return (s.indexOf(',') > -1 ? parseFloat(s.replace(/\./g, '').replace(',', '.')) : parseFloat(s)) || 0;
  }
  /** Linhas cruas (objetos {cabeçalho: valor}) → lista padronizada de cobranças. */
  function asaasLinhas(rows) {
    function pega(r, nomes) {
      const ks = Object.keys(r);
      for (let i = 0; i < ks.length; i++) if (nomes.indexOf(norm(ks[i])) > -1) return r[ks[i]];
      return '';
    }
    return (rows || []).map(function (r) {
      return {
        ident: String(pega(r, ['identificador', 'id']) || '').replace(/\.0$/, '').trim(),
        nome: String(pega(r, ['nome', 'cliente', 'nome do cliente', 'pagador']) || '').trim(),
        celular: String(pega(r, ['celular', 'fone', 'telefone']) || '').trim(),
        vencimento: asaasData(pega(r, ['vencimento', 'data de vencimento'])),
        vencimentoOriginal: asaasData(pega(r, ['vencimento original'])),
        pagamento: asaasData(pega(r, ['data de pagamento', 'data do pagamento'])),
        valor: asaasNumero(pega(r, ['valor', 'valor (r$)'])),
        status: String(pega(r, ['situacao', 'status']) || '').trim(),
        descricao: String(pega(r, ['descricao', 'historico', 'referencia']) || '').trim(),
        forma: String(pega(r, ['forma de pagamento']) || '').trim(),
      };
    }).filter(function (l) { return l.nome && l.status; });
  }
  const ASAAS_STOP = ['mensalidade', 'mensalide', 'mennsalidade', 'academia', 'acdemia', 'washington', 'washigton', 'material', 'fluent', 'de', 'da', 'do', 'dos', 'das', 'e', 'descricao', 'nao', 'informada', 'matricula'];
  function tokensNome(s) { return norm(s).replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(function (w) { return w.length > 1 && ASAAS_STOP.indexOf(w) < 0; }); }
  /** Melhor aluno para um nome (score = palavras em comum, exigindo o 1º nome igual). Só devolve se for único. */
  function melhorAlunoPorNome(nome, alunos) {
    const tk = tokensNome(nome);
    if (!tk.length) return null;
    let melhor = 0, achados = [];
    alunos.forEach(function (a) {
      const ta = tokensNome(a.nome);
      if (!ta.length || ta[0] !== tk[0]) return;
      const comum = tk.filter(function (w) { return ta.indexOf(w) > -1; }).length;
      // Precisa bater pelo menos 3 palavras, ou todas as do nome mais curto (ex.: cadastro só "Adenilton",
      // descrição só "Miguel Ferreira"). Evita casar "Ana Carolina de Oliveira" com "Ana Paula de Oliveira".
      const ok = comum >= Math.min(3, ta.length, tk.length);
      if (!ok) return;
      if (comum > melhor) { melhor = comum; achados = [a]; } else if (comum === melhor) achados.push(a);
    });
    return achados.length === 1 ? achados[0] : null;
  }
  /** Acha o aluno de uma cobrança: nome igual, responsável financeiro, nome do aluno na descrição, ou nome parecido. */
  function asaasCasarAluno(l, alunos) {
    const ativos = (alunos || []).filter(function (a) { return a && a.nome; });
    const key = norm(l.nome);
    let a = ativos.find(function (x) { return norm(x.nome) === key; });
    if (a) return { aluno: a, como: 'nome' };
    a = ativos.find(function (x) { return x.responsavelFinanceiro && norm(x.responsavelFinanceiro) === key; });
    if (a) return { aluno: a, como: 'responsavel' };
    const desc = l.descricao || '';
    const depoisTraco = desc.indexOf('-') > -1 ? desc.slice(desc.indexOf('-') + 1) : '';
    if (depoisTraco.trim()) { a = melhorAlunoPorNome(depoisTraco, ativos); if (a) return { aluno: a, como: 'descricao' }; }
    const descN = norm(desc);
    if (descN) { a = ativos.find(function (x) { return norm(x.nome).split(' ').length >= 2 && descN.indexOf(norm(x.nome)) > -1; }); if (a) return { aluno: a, como: 'descricao' }; }
    if (tokensNome(desc).length >= 2) { a = melhorAlunoPorNome(desc, ativos); if (a) return { aluno: a, como: 'descricao' }; }
    a = melhorAlunoPorNome(l.nome, ativos);
    if (a) return { aluno: a, como: 'parecido' };
    return null;
  }
  function asaasTipo(desc) { const d = norm(desc); if (d.indexOf('material') > -1) return 'Material'; if (/mens?al|mennsal/.test(d)) return 'Mensalidade'; if (d.indexOf('matricula') > -1) return 'Matrícula'; return ''; }
  function asaasSemDescricao(desc) { const d = norm(desc).replace(/[^a-z ]/g, '').trim(); return !d || d === 'descricao nao informada' || d === 'academia washington'; }
  function asaasForma(f) { const n = norm(f); if (n.indexOf('pix') > -1) return 'Pix'; if (n.indexOf('boleto') > -1) return 'Boleto'; if (n.indexOf('debito') > -1) return 'Cartão de débito'; if (n.indexOf('cartao') > -1 || n.indexOf('credito') > -1) return 'Cartão de crédito'; if (n.indexOf('dinheiro') > -1) return 'Dinheiro'; if (n.indexOf('transfer') > -1) return 'Transferência'; return 'Boleto'; }
  const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  function mesCurto(iso) { return iso ? (MESES_CURTOS[Number(iso.slice(5, 7)) - 1] + '/' + iso.slice(0, 4)) : ''; }
  function brl(v) { return 'R$ ' + (Number(v) || 0).toFixed(2).replace('.', ','); }
  function dm(iso) { return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : ''; }
  /**
   * Monta o plano de importação sem mexer em nada. `estado` = { alunos, entradas, pendencias }.
   * Devolve { entradas: [novas], repetidas, situacao: {alunoId: {...}}, pendencias: [novas],
   *           resolver: [{id, texto}], semAluno, contagem }.
   */
  function asaasPlano(linhas, estado) {
    const alunos = estado.alunos || [], entradas = estado.entradas || [], pends = estado.pendencias || [];
    const pagas = [], abertas = [];
    linhas.forEach(function (l) {
      const st = statusPagamento(l.status);
      if (st === 'em dia') pagas.push(l); else if (st === 'atrasado' || st === 'pendente') abertas.push(l);
    });
    const jaImportadas = {}; entradas.forEach(function (e) { if (e.asaasId) jaImportadas[e.asaasId] = true; });
    const chavesPend = {}; pends.forEach(function (p) { if (p.chave) chavesPend[p.chave] = p; });
    const plano = { entradas: [], repetidas: 0, manuais: 0, situacao: {}, pendencias: [], resolver: [], contagem: { pagas: pagas.length, abertas: abertas.length, valorPago: 0, valorAberto: 0 } };
    const casados = {}, conferirPorPagador = {};
    function casar(l) { const k = l.ident || (l.nome + l.valor + l.vencimento); if (!(k in casados)) casados[k] = asaasCasarAluno(l, alunos); return casados[k]; }
    // 1) Recebidas → entradas
    pagas.forEach(function (l) {
      plano.contagem.valorPago += l.valor;
      if (l.ident && jaImportadas[l.ident]) { plano.repetidas++; return; }
      const c = casar(l), a = c && c.aluno;
      const data = l.pagamento || l.vencimento;
      // Já lançada à mão? (mesmo aluno/nome, mesmo valor, mesma data)
      const manual = entradas.some(function (e) {
        if (e.asaasId) return false;
        const mesmoAluno = a ? e.alunoId === a.id : norm(e.alunoNome) === norm(l.nome);
        return mesmoAluno && Math.abs(Number(String(e.valor).replace(',', '.')) - l.valor) < 0.01 && e.data === data;
      });
      if (manual) { plano.manuais++; return; }
      const tipo = asaasTipo(l.descricao);
      plano.entradas.push({
        data: data, alunoId: a ? a.id : '', alunoNome: a ? a.nome : l.nome, valor: l.valor.toFixed(2), formaPagamento: asaasForma(l.forma),
        referente: (tipo || 'Cobrança') + (l.vencimento ? (' · venc. ' + mesCurto(l.vencimento)) : ''),
        obs: 'Asaas' + (a && norm(a.nome) !== norm(l.nome) ? (' · pago por ' + l.nome) : '') + (l.descricao && !asaasSemDescricao(l.descricao) ? (' · ' + l.descricao) : ''),
        asaasId: l.ident,
      });
      if (!a || (asaasSemDescricao(l.descricao) && c.como === 'parecido')) {
        const ja = pends.some(function (p) { return l.ident && (p.asaasIds || []).indexOf(l.ident) > -1; });
        if (ja) return;
        const linha = '• ' + brl(l.valor) + ' pago em ' + dm(l.pagamento) + ' (' + asaasForma(l.forma) + '), descrição no Asaas: ' + (asaasSemDescricao(l.descricao) ? 'nenhuma' : '"' + l.descricao + '"');
        const k = norm(l.nome);
        let p = conferirPorPagador[k];
        if (!p) {
          p = conferirPorPagador[k] = {
            chave: 'asaas-conferir:' + (l.ident || k), categoria: 'cobranca', alunoId: a ? a.id : '',
            texto: 'Conferir pagamento de ' + l.nome + ': de qual aluno e turma é?',
            linhas: [], semDescricao: false, asaasIds: [],
          };
          plano.pendencias.push(p);
        }
        p.linhas.push(linha);
        if (asaasSemDescricao(l.descricao)) p.semDescricao = true;
        if (l.ident) p.asaasIds.push(l.ident);
      }
    });
    // 2) Situação de pagamento por aluno (atrasado/pendente vence "em dia")
    function marcar(a, status, l) {
      const s = plano.situacao[a.id] || (plano.situacao[a.id] = { status: 'em dia', valorEmAberto: 0, obs: [] });
      if (status === 'atrasado' || (status === 'pendente' && s.status === 'em dia')) s.status = status;
      if (status !== 'em dia') s.valorEmAberto += l.valor;
      s.obs.push(l.status + (l.vencimento ? (' venc. ' + dm(l.vencimento)) : '') + ' ' + brl(l.valor));
    }
    pagas.forEach(function (l) { const c = casar(l); if (c && c.aluno.formaPagamento !== 'unidade') marcar(c.aluno, 'em dia', l); });
    // 3) Em aberto → situação do aluno + pendência de cobrança (uma por pagador)
    const porPagador = {};
    abertas.forEach(function (l) {
      plano.contagem.valorAberto += l.valor;
      const c = casar(l);
      if (c && c.aluno.formaPagamento !== 'unidade') marcar(c.aluno, statusPagamento(l.status), l);
      (porPagador[norm(l.nome)] = porPagador[norm(l.nome)] || []).push({ l: l, c: c });
    });
    Object.keys(porPagador).forEach(function (k) {
      const itens = porPagador[k], l0 = itens[0].l;
      const novos = itens.filter(function (it) { return !it.l.ident || !pends.some(function (p) { return (p.asaasIds || []).indexOf(it.l.ident) > -1; }); });
      if (!novos.length) return;
      const alunosNomes = Array.from(new Set(novos.map(function (it) { return it.c ? it.c.aluno.nome : ''; }).filter(Boolean)));
      const total = novos.reduce(function (s, it) { return s + it.l.valor; }, 0);
      plano.pendencias.push({
        chave: 'asaas-aberto:' + novos.map(function (it) { return it.l.ident; }).join(','), categoria: 'cobranca',
        alunoId: novos[0].c ? novos[0].c.aluno.id : '',
        texto: 'Cobrar ' + l0.nome + ' · ' + brl(total) + ' em aberto' + (alunosNomes.length && norm(alunosNomes.join(' ')) !== norm(l0.nome) ? (' (' + alunosNomes.join(', ') + ')') : ''),
        detalhe: novos.map(function (it) { return '• ' + (it.l.descricao || 'Sem descrição') + ': ' + brl(it.l.valor) + ', ' + it.l.status.toLowerCase() + ', venc. ' + dm(it.l.vencimento) + (it.l.vencimentoOriginal && it.l.vencimentoOriginal !== it.l.vencimento ? (' (era ' + dm(it.l.vencimentoOriginal) + ')') : ''); }).join('\n') +
          (l0.celular ? ('\nCelular: ' + l0.celular) : '') + (alunosNomes.length ? '' : '\nAluno não identificado: descubra de quem é e preencha "Nome de quem paga no Asaas" na ficha do aluno.'),
        asaasIds: novos.map(function (it) { return it.l.ident; }).filter(Boolean),
      });
    });
    // 3b) Aluno que já saiu (cancelado no painel) mas continua sendo cobrado no Asaas
    const canceladosVistos = {};
    pagas.concat(abertas).forEach(function (l) {
      const c = casar(l);
      if (!c || !c.aluno.cancelado || canceladosVistos[c.aluno.id]) return;
      const chave = 'asaas-cancelado:' + c.aluno.id + ':' + (l.vencimento || '').slice(0, 7);
      if (chavesPend[chave]) return;
      canceladosVistos[c.aluno.id] = true;
      plano.pendencias.push({
        chave: chave, categoria: 'cobranca', alunoId: c.aluno.id,
        texto: c.aluno.nome + ' saiu da turma, mas ainda tem cobrança no Asaas',
        detalhe: '• ' + (l.descricao || 'Cobrança') + ': ' + brl(l.valor) + ', ' + l.status.toLowerCase() + ', venc. ' + dm(l.vencimento) +
          '\nCancelar a recorrência no Asaas e decidir o que fazer com o valor (estorno ou abatimento).',
        asaasIds: l.ident ? [l.ident] : [],
      });
    });
    // 4) Pendências de cobrança que agora aparecem pagas → resolver
    const pagasPorId = {}; pagas.forEach(function (l) { if (l.ident) pagasPorId[l.ident] = l; });
    pends.forEach(function (p) {
      if (p.resolvida || p.categoria !== 'cobranca' || !(p.asaasIds || []).length || String(p.chave || '').indexOf('asaas-aberto:') !== 0) return;
      const pagos = p.asaasIds.filter(function (id) { return pagasPorId[id]; });
      if (pagos.length === p.asaasIds.length) plano.resolver.push({ id: p.id, texto: 'Pagamento confirmado no relatório do Asaas: ' + pagos.map(function (id) { return dm(pagasPorId[id].pagamento) + ' ' + brl(pagasPorId[id].valor); }).join('; ') + '.' });
    });
    Object.keys(conferirPorPagador).forEach(function (k) {
      const p = conferirPorPagador[k];
      p.detalhe = p.linhas.join('\n') + (p.semDescricao ? '\nInforme também se o valor é mensalidade, matrícula ou material.' : '') +
        '\nQuando descobrir o aluno, preencha "Nome de quem paga no Asaas" na ficha dele: assim os próximos relatórios já reconhecem.';
      delete p.linhas; delete p.semDescricao;
    });
    plano.contagem.valorPago = Math.round(plano.contagem.valorPago * 100) / 100;
    plano.contagem.valorAberto = Math.round(plano.contagem.valorAberto * 100) / 100;
    return plano;
  }

  return {
    asaasLinhas: asaasLinhas, asaasCasarAluno: asaasCasarAluno, asaasPlano: asaasPlano,
    pontoSlug: pontoSlug, fmtHM: fmtHM, dataLocal: dataLocal, horaLocal: horaLocal,
    periodoFechamento: periodoFechamento, parearPonto: parearPonto, compararComHorario: compararComHorario,
    DIAS_ORDEM: DIAS_ORDEM, DIAS_FULL: DIAS_FULL,
    norm: norm, diasDaTurma: diasDaTurma, horarioMin: horarioMin, horariosSeSobrepoem: horariosSeSobrepoem,
    gradeSemanal: gradeSemanal, conferirConflitos: conferirConflitos, juntarNatural: juntarNatural,
    fimContrato: fimContrato, diasAte: diasAte, semestreDeData: semestreDeData, diasEmAtraso: diasEmAtraso,
    somaDias: somaDias, segundaDaSemana: segundaDaSemana, fmtCurta: fmtCurta, fmtLonga: fmtLonga, horaParaMin: horaParaMin,
    telefoneParaWhatsApp: telefoneParaWhatsApp, linkWhatsApp: linkWhatsApp,
    mensagemRematricula: mensagemRematricula, mensagemMaterialDidatico: mensagemMaterialDidatico, mensagemCobranca: mensagemCobranca,
    mensagemConfirmacaoCompromisso: mensagemConfirmacaoCompromisso,
    diasAteAniversario: diasAteAniversario, mensagemAniversario: mensagemAniversario,
    proximaData: proximaData, icsTurma: icsTurma, baixarIcsTurma: baixarIcsTurma,
    icsCompromisso: icsCompromisso, baixarIcsCompromisso: baixarIcsCompromisso,
    diaDaSemana: diaDaSemana, resumoFrequencia: resumoFrequencia,
    parseAsaasCSV: parseAsaasCSV, statusPagamento: statusPagamento,
  };
});

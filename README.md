# Painel acadêmico · Washington Ilha

Site simples (sem servidor próprio, mesmo modelo do painel do Polo 1740) para a coordenação da Washington Ilha acompanhar a rotina acadêmica: grade semanal de turmas, professores, alunos matriculados (pagamento e frequência), rematrícula e material didático, e conferência de choques de horário.

As turmas aqui são aulas semanais recorrentes (ex.: "SEG/QUA 18h-19h"), não datas de um mês específico como no painel do Polo 1740 — por isso a tela principal é um **calendário da semana** (com as datas reais de cada dia, não só o dia da semana), e não um calendário de mês.

## O que já veio importado

A partir da planilha enviada (`Turmas 2026.1`, `Alunos por turma 2026.1`, `Turmas 2026.2`, `Alunos por turma 2026.2`), o painel já chega com:

- **76 turmas** (36 de 2026.1, 37 de 2026.2, 3 "a confirmar"), com dia da semana, horário, professor(a), sala (quando informada) e situação.
- **217 alunos únicos**, já associados às turmas em que aparecem nas planilhas enviadas.
- **8 professores**: Sara Rodrigues, Leticia Lindo, Camila Menezes, Gabriel Fontes, Luciano Sartori, Ana Beatriz, Nicolas Rodrigues e Raphael Lemos.
- Turmas marcadas com **"Encerra próx. semestre"** quando a planilha indicou que elas terminam na virada do semestre.

Alguns alunos entraram sem turma super confiável porque o cabeçalho da planilha de alunos tinha um erro de digitação ou uma divergência de dia em relação à planilha de turmas — nesses poucos casos o painel usou o melhor palpite possível (turma com esse nome, ignorando o dia) em vez de descartar o aluno. Vale revisar esses casos quando notar um aluno na turma errada.

## Matrículas: registrar, incluir na turma e fazer o checklist

Na aba **Matrículas**, assim que uma matrícula é fechada:

1. Escolha o aluno (se já existir no painel) ou digite o nome de um aluno novo.
2. Escolha a turma e a data de início.
3. Preencha a data de pagamento, se ele paga pelo Asaas ou direto na unidade, o valor da mensalidade, o livro didático e o valor do material.
4. Se teve desconto especial no primeiro mês, marque a caixinha e informe o valor cobrado com desconto e uma observação (ex.: "promoção de matrícula").
5. Clique em **Registrar matrícula**.

Isso já **inclui o aluno na turma automaticamente** (ele passa a aparecer no calendário da semana, em Turmas e na lista de Alunos, já com o livro didático anotado no cadastro) e cria o **checklist** da matrícula, com quatro itens que a equipe marca conforme for fazendo:

- Subiu a matrícula no sistema da Washington
- Subiu o boleto no Asaas (esse item não aparece para quem paga na unidade)
- Responsável assinou o contrato
- Cobrado para comprar o material/livro

A matrícula fica em "Checklist pendente" até todos os itens serem marcados. O card de cada matrícula mostra tudo o que foi preenchido (data de início, data de pagamento, mensalidade, desconto do primeiro mês se houver, livro e valor do material) pra equipe já ter os dados certos pra subir no Asaas e no sistema da Washington, sem precisar ir atrás da ficha em outro lugar.

**Contrato semestral automático**: o painel calcula o fim do contrato sozinho — sempre 30/06 (se o aluno começou entre janeiro e junho) ou 31/12 (se começou entre julho e dezembro), não importa o dia exato em que ele entrou. Quando faltam 30 dias ou menos para o fim do contrato, o card da matrícula mostra um aviso de "Rematrícula em X dia(s)"; depois que vence, mostra "Contrato venceu há X dia(s)" — é o sinal pra equipe rodar a rematrícula, refazer o contrato e avisar sobre o material didático do próximo período.

**Livro didático**: cada matrícula (e cada aluno, em Alunos › Abrir) tem um campo para anotar qual livro ele precisa comprar. Com o telefone cadastrado, o botão "Avisar sobre o livro" já abre o WhatsApp com a mensagem certa, citando o nome do livro.

## Compromissos: agenda de reuniões (com pais, responsáveis, equipe)

Na aba **Compromissos**, dá pra agendar qualquer reunião ou compromisso avulso — reunião com os pais de uma aluna, conversa com um responsável, reunião interna da equipe — sem precisar que seja uma aula recorrente:

1. Dê um título (ex.: "Reunião com os pais da Fulana").
2. Se for sobre um aluno já cadastrado, escolha-o na lista (o telefone dele já vem junto, pra confirmar por WhatsApp depois). Se não for, digite o nome livremente.
3. Escolha **com quem** é o compromisso — digite livremente (Isa, Camila, Isa e Camila, o nome de um professor, quem for); o campo sugere nomes já usados antes, mas aceita qualquer texto.
4. Preencha data, horário e local (pode ser "Sala da coordenação", "Google Meet", etc.) e uma observação, se quiser.
5. Clique em **Agendar**.

O compromisso aparece separado em **Hoje**, **Atrasados** (passou a data e ainda está como agendado), **Próximos** e **Realizados/cancelados**, então a equipe sempre vê primeiro o que é urgente. Cada card tem botões para marcar como **realizado**, **cancelar**, **baixar o .ics** (pra jogar na agenda pessoal) e, se o compromisso estiver ligado a um aluno com telefone cadastrado, **confirmar no WhatsApp** com uma mensagem já escrita citando data, horário e local.

**Aparece também no calendário da Semana**: todo compromisso agendado (com qualquer "com quem") some na aba Compromissos *e também* mostra um bloco destacado (fundo azul claro, com 📅) no dia certo da aba **Semana**, junto com as aulas daquele dia — clicar nele leva direto pra aba Compromissos. Assim dá pra ver a agenda inteira (aulas + reuniões) num único lugar, sem precisar ficar trocando de aba.

## Frequência: chamada por turma/aula

Na aba **Frequência**, escolha a turma e a data da aula — o painel avisa se a data não bate com o dia da semana da turma, mas não bloqueia, pois às vezes há reposição. A lista de alunos vem **em branco**: cada um tem dois botões, "Presente" e "Faltou", e nenhum vem pré-marcado — a equipe marca um por um. Só é possível **Salvar chamada** depois que todo mundo da turma estiver marcado (o painel avisa quantos ainda faltam marcar). Reabrir a mesma turma na mesma data (ou clicar em "editar" no histórico) carrega a chamada já feita, em vez de começar do zero.

Cada aluno, ao lado do nome na chamada, já mostra o **% de presença** acumulado. E a aba tem uma seção de **Faltas recorrentes**, que lista automaticamente qualquer aluno com 3 ou mais chamadas registradas e presença abaixo de 75% — é o sinal pra equipe ligar pra família antes que o problema cresça.

## Inadimplência: lista de quem está atrasado/pendente, com régua de cobrança

A aba **Inadimplência** reúne automaticamente todo aluno marcado como "atrasado" ou "pendente" (vindo da importação do Asaas ou marcado manualmente no cadastro) — sem precisar caçar um por um em Alunos. Pra cada aluno dá pra:

- Anotar o **valor em aberto** (a aba soma esse valor de todos e mostra o total no topo).
- Ver quando foi a **última atualização** de pagamento e a observação que veio do Asaas (cliente, status, vencimento).
- Mandar a **régua de cobrança** por WhatsApp: três botões — **Lembrete** (primeiro aviso, tom leve), **2º aviso** (reforço) e **Aviso final** (tom mais sério, citando risco de suspensão) — cada um com a mensagem já escrita pra equipe revisar e enviar. O card guarda qual foi a última etapa enviada e há quanto tempo, pra ninguém mandar a mesma cobrança duas vezes sem querer ou esquecer de escalar pro aviso final.

## Turmas: criar, editar, excluir e ver exatamente quem está em cada uma

Em **Turmas**, o botão **+ Nova turma** abre um formulário com nome da turma, semestre, dia(s) da semana, horário, professor(a), sala, situação e observação. Todo card de turma agora tem um botão **Editar**, que abre o mesmo formulário já preenchido — muda o que precisar e clica em Salvar. Dentro da edição também tem **Excluir turma** (pede confirmação; os alunos que estavam nela deixam de tê-la no cadastro deles, mas o histórico de matrícula continua guardando o nome da turma).

Ao clicar em **Ver alunos** de uma turma, a lista agora mostra, pra cada aluno: nome, **telefone** (quando cadastrado) e um botão de **WhatsApp** direto ali, sem precisar abrir o cadastro completo — é pra equipe conseguir ver rapidinho quem está em cada turma e já falar com a família. Dá pra **adicionar um aluno já cadastrado a essa turma** (seleciona o nome numa lista e clica em Adicionar) e **remover um aluno da turma** direto por ali, sem precisar ir em Matrículas ou editar o cadastro do aluno.

## Material, Entradas e Despesas: as 3 planilhas que a equipe preenchia por fora, agora dentro do sistema

Essas três abas substituem as planilhas separadas de controle de material, entradas (dinheiro recebido) e despesas — pra equipe preencher direto no painel, sem precisar abrir outro arquivo. Elas começam **vazias** (o histórico antigo das planilhas não foi importado); é só passar a lançar dali pra frente.

- **Material**: registra o pedido de material didático de um aluno (nível/turma, semestre, se já pagou à Washington, data em que recebeu/pediu). O card entra em **Pendentes de entrega**; preencha **Data de envio** e **Data de entrega** quando chegar e clique no botão **Entregue** para ele passar pra lista de **Entregues**. Os campos de data, o botão "Pago"/"Não pago" e a observação são editáveis direto na tabela, sem precisar abrir outro formulário. Filtra por semestre, igual Turmas.
- **Entradas**: lançamento de dinheiro recebido — aluno (ou nome livre, se não for aluno cadastrado), valor, data, forma de pagamento (Pix, Boleto, Cartão de crédito/débito, Dinheiro, Transferência) e referente a quê (mensalidade, material, matrícula, aula particular etc.). Filtra por mês e mostra o total do período filtrado.
- **Despesas**: lançamento de gastos do curso — descrição, categoria (Hora Aula, Transporte, Custos Fixos, Mercado, Papelaria, Salários, Equipamentos, Ações, Metas, Outro), valor e quem pagou (Isabella, Camila, Conta do curso, ou um professor). Dá pra marcar **Pago**/**A pagar** com um clique. Filtra por mês e mostra o total do período, com o total quebrado por categoria.

## Abas do painel

- **Semana**: calendário com as datas reais da semana (SEG a DOM), já mostrando o semestre certo conforme a data. Use "Semana anterior" / "Hoje" / "Próxima semana" para navegar. Cada aula ganhou uma cor de acordo com o(a) professor(a) — clique no nome dele(a) na legenda acima da grade para destacar só as aulas dele(a) e apagar visualmente o resto, útil nos dias com muitas turmas. Clique numa aula para ver a lista de alunos e baixar o calendário dela.
- **Pendências**: lista do que precisa ser resolvido na unidade (documento, ligação, contrato pendente etc.), podendo ligar cada item a um aluno e/ou turma e dar um prazo, para nada passar batido.
- **Turmas**: lista completa, filtrável por situação (Em andamento, Em formação, Finalizada, Não formou turma etc.), com os mesmos botões de calendário.
- **Matrículas**: onde a equipe registra cada matrícula fechada — veja a seção própria abaixo.
- **Compromissos**: agenda de reuniões e compromissos avulsos (pais, responsáveis, equipe) — veja a seção própria acima.
- **Frequência**: chamada por turma/aula e alerta de faltas recorrentes — veja a seção própria acima.
- **Inadimplência**: lista de atrasados/pendentes com régua de cobrança por WhatsApp — veja a seção própria acima.
- **Material**: controle de pedido/entrega de material didático por aluno — veja a seção própria acima.
- **Entradas**: lançamento de dinheiro recebido (mensalidades, material, matrícula etc.) — veja a seção própria acima.
- **Despesas**: lançamento de gastos do curso, por categoria — veja a seção própria acima.
- **Alunos**: lista de todos os alunos matriculados, com situação de pagamento, quantos registros de frequência já tem, e se já recebeu mensagem de rematrícula/material didático. Busque por nome e filtre por situação de pagamento (inclusive "cancelamento solicitado"). Clique em "Abrir" para ver o cadastro completo — data em que o aluno começou com a gente, data de rematrícula (calculada a partir do contrato da matrícula), se já comprou o livro didático, e se solicitou cancelamento (com data e motivo) — e preparar mensagens de WhatsApp.
- **Comunicados**: escreva um aviso e dispare por WhatsApp para todos os alunos de uma turma (ou para todos com telefone cadastrado), acompanhando quem já recebeu.
- **Professores**: cadastro de telefone de cada professor(a), com botão para chamar no WhatsApp.
- **Conferência**: aponta automaticamente choques de horário do mesmo professor ou da mesma sala **dentro do mesmo semestre** (turmas de 2026.1 e 2026.2 não acontecem ao mesmo tempo, então não são comparadas entre si), além de turmas em andamento sem sala definida.
- **Buscar**: procura turma, professor, sala ou aluno ao mesmo tempo.
- **Dados**: importar relatório do Asaas, acompanhar a sincronização entre navegadores, baixar o `data.js` atualizado e ver o registro de quem mudou o quê.

## Calendário: baixar .ics ou adicionar ao Google Agenda

Cada turma tem dois botões:
- **Baixar .ics**: gera um arquivo de calendário com a aula recorrente (toca em qualquer agenda — Google, Outlook, Apple).
- **Adicionar ao Google Agenda**: abre direto a tela de "novo evento" do Google Agenda já preenchida, recorrente nos dias certos.

Isso é **só uma via** (a pessoa confirma e salva na própria agenda dela) — não é uma sincronização automática de mão dupla com o Google. Avaliamos a sincronização completa (via API/OAuth), mas ela exigiria um servidor próprio e custo de hospedagem contínuo, então optamos por manter o painel 100% estático como o do Polo 1740, com esses links de "adicionar" em vez disso.

## Telefone e e-mail: situação inicial já carregada (relatório de alunos)

A partir do "Relatório de Alunos" que você mandou (com CARD, nome, idade, e-mail, endereço, responsável e telefone), o painel já chega com **187 alunos com telefone** e **183 com e-mail** preenchidos automaticamente, batendo o nome do relatório com o nome do aluno já cadastrado no painel (de forma exata ou por um "começa com" seguro — só quando havia só um candidato possível).

Os que não vieram automáticos (nomes abreviados demais pra cruzar com segurança, tipo só "Camila" ou "Ed", ou pequenas variações de grafia) ficam com telefone/e-mail em branco — é só abrir o cadastro do aluno em **Alunos › Abrir** e preencher na mão; a partir de agora dá pra editar ali mesmo o nome, telefone e e-mail do aluno, além de pagamento e livro didático, tudo no mesmo lugar.

**Mandar mensagem direto pelo sistema**: com o telefone cadastrado, o cadastro do aluno (Alunos › Abrir) tem uma caixinha de **mensagem livre** — escreve qualquer texto e clica em "Enviar no WhatsApp" pra abrir a conversa já com a mensagem pronta pra mandar (além das mensagens prontas de rematrícula, material didático e cobrança, que continuam lá). E quem só precisa falar rápido com um aluno, sem abrir o cadastro inteiro, agora tem um botão **WhatsApp** direto na linha dele na lista de Alunos.

> **Importante se você já abriu uma versão anterior do painel no mesmo navegador**: o painel guarda os dados no navegador (pra não perder edições feitas pela equipe) e, por padrão, não troca esses dados sozinho. Isso significa que, se você já tinha aberto o painel antes de eu importar os telefones/e-mails, o navegador ficaria com a versão antiga (sem telefone) guardada, mesmo eu mandando um `data.js` novo. Resolvi isso: agora o painel confere se chegou alguma informação nova (como os telefones/e-mails importados) e completa automaticamente só os campos que ainda estavam em branco, sem apagar nada que a equipe já tenha editado na mão. Então, ao abrir a versão mais nova do painel (artefato ou zip), os telefones e e-mails já devem aparecer sozinhos — não precisa limpar o navegador nem reimportar nada.

## Pagamentos: situação inicial já carregada (maio a setembro de 2026)

A partir dos relatórios do Asaas (maio a setembro) e da planilha de "Relatório de Entradas" (pagamentos feitos direto na unidade) que você mandou, o painel já chega com **78 alunos com situação de pagamento conhecida**:

- **48 batidos com o Asaas** — 42 pelo nome do próprio aluno, e mais 6 pelo nome do responsável (só nos casos em que o responsável aparecia associado a um único aluno sem ambiguidade — nomes de responsável repetidos entre famílias diferentes, como "Jéssica" ou "Simone", ficaram de fora de propósito, pra não arriscar atribuir a mensalidade errada).
- **30 marcados como "paga na unidade"** (vieram do Relatório de Entradas e não têm registro no Asaas).

Os outros alunos ficaram como "desconhecido" — a maioria porque o nome que paga (geralmente o responsável) é diferente do nome do aluno na turma e não deu pra cruzar com segurança. Vale revisar esses manualmente em Alunos, marcando "Onde paga" e a situação.

**Bolsista, aluno que saiu, ou cadastro duplicado**: em **Alunos › Abrir**, agora tem um campo **Aluno bolsista** — marcando essa caixinha, o aluno some da aba Inadimplência e ganha uma etiqueta "Bolsista" na lista (pra equipe não ficar cobrando quem não paga mensalidade). Tem também um filtro "bolsistas" na busca de Alunos pra ver só eles. E pra aluno que já saiu da escola, duplicado, ou cadastro feito por engano, tem o botão **Excluir aluno** no fim do mesmo cadastro — ele sai da lista e das turmas, mas o histórico de matrícula/compromissos já registrado continua guardando o nome dele.

## Pagamentos: importar relatório do Asaas

Por segurança, o painel **não se conecta direto no Asaas** (um site público no GitHub Pages não pode guardar a chave de API do Asaas). Em vez disso:

1. No Asaas, exporte o relatório de cobranças em CSV (colunas de cliente, status, vencimento e valor — nomes de coluna comuns em português já são reconhecidos).
2. Em **Dados › Importar relatório do Asaas**, escolha o arquivo.
3. O painel casa cada linha pelo **nome do cliente** com o nome do aluno cadastrado e atualiza a situação (em dia / pendente / atrasado). Nomes que não encontrarem correspondência aparecem no aviso após a importação — provavelmente é um apelido diferente do nome completo cadastrado.

Repita essa importação periodicamente (ex.: toda semana) para manter a situação de pagamento atualizada.

**Alunos que pagam direto na unidade** (não pelo Asaas): em **Alunos › Abrir**, marque "Na unidade" no campo **Onde paga**. Esses alunos ficam de fora da importação do Asaas (mesmo que o nome bata por coincidência) e a situação de pagamento deles precisa ser marcada manualmente em "Situação manual", já que não existe um relatório automático pra esse jeito de pagar ainda.

## Mensagens de WhatsApp (rematrícula, material didático, cobrança)

Em **Alunos › Abrir**, com o telefone cadastrado, aparecem botões que abrem o WhatsApp **com a mensagem já escrita**, para a equipe revisar e enviar manualmente — o painel não manda nada sozinho. Depois de enviar, clique no botão de novo (ele marca a mensagem como "enviada" na lista de alunos, pra você saber quem já foi avisado).

## Frequência

A partir de agora, o painel é o lugar de registrar frequência (não havia nenhum sistema anterior para importar). Isso ainda não tem uma tela própria nesta primeira versão — pode ser adicionado como próximo passo, com um botão de chamada por turma/aula.

## Como publicar no GitHub Pages (uma vez só)

1. Entre em github.com e crie um repositório novo (ex.: `painel-washington`). Pode deixar **privado** (recomendado, já que o site tem nome/telefone de aluno) ou público — nos dois casos o GitHub Pages funciona.
2. Clique em **Add file › Upload files** e arraste todo o conteúdo desta pasta (`index.html`, `app.js`, `logic.js`, `sync.js`, `sync-config.js`, `data.js`, `styles.css`, `README.md`).
3. Clique em **Commit changes**.
4. Vá em **Settings › Pages**. Em *Branch*, escolha `main` e a pasta `/ (root)`. Salve.
   - Se o repositório for **privado**, o GitHub Pages só aparece disponível em contas **GitHub Pro/Team/Enterprise** (nos planos gratuitos, Pages exige repositório público). Se não tiver um desses planos, crie o repositório como público mesmo — depois de ligar o login do Firebase (próxima seção), só quem tiver usuário e senha cadastrados consegue ver os dados de verdade; quem não tiver login só vê a tela de entrar.
5. Em 1 a 2 minutos o endereço aparece na mesma tela (algo como `https://seu-usuario.github.io/painel-washington/`).

> **Antes** de ligar o login do Firebase (próxima seção), qualquer pessoa com o link do GitHub Pages enxerga os dados direto (nomes, telefones, pagamento) sem precisar de senha nenhuma — porque eles vêm junto no arquivo `data.js`. Ligue a sincronização com login **logo depois de publicar**, antes de espalhar o link pra equipe.

## Sincronizar com login de cada pessoa da equipe (recomendado)

Mesmo esquema do painel do Polo 1740 — mas **este é um projeto Firebase separado**, só para a Washington Ilha, pra não misturar os dados dos dois painéis. Com isso ligado, a equipe passa a ver os mesmos dados atualizados em tempo real (não precisa mais baixar/subir `data.js` depois de editar) e **cada pessoa entra com seu próprio e-mail e senha** — sem login, a tela fica bloqueada numa página de "Entrar".

### 1. Criar o projeto e o banco de dados

1. Acesse **console.firebase.google.com**, entre com uma conta Google e clique em **Adicionar projeto**. Dê um nome (ex.: `academia-washington`) e conclua a criação (pode desligar o Google Analytics).
2. No painel do projeto, clique no ícone **`</>`** ("Web") para registrar um app da Web. Dê um apelido (ex.: `painel`) e clique em **Registrar app**.
3. O Firebase mostra um bloco `firebaseConfig = { apiKey: ..., authDomain: ..., ... }`. Copie esse objeto inteiro.
4. No menu lateral, vá em **Compilação › Firestore Database › Criar banco de dados**. Escolha um local (ex.: `southamerica-east1`) e comece em **modo de teste** (vamos travar o acesso de verdade no passo 3 abaixo, com login).

### 2. Ativar o login por e-mail/senha e cadastrar cada pessoa

1. No menu lateral, vá em **Compilação › Authentication › Introdução (Get started)**.
2. Na lista de métodos de login, clique em **E-mail/senha**, ative a primeira opção e clique em **Salvar**.
3. Vá na aba **Users (Usuários)** e clique em **Add user (Adicionar usuário)**. Cadastre um e-mail e uma senha (a própria pessoa pode trocar a senha depois, se quiser — não tem essa tela ainda no painel, mas dá pra trocar aqui mesmo no Firebase: clique nos três pontinhos do usuário › **Reset password**, ou já defina uma senha que ela troca de cabeça).
4. Repita o passo 3 para cada pessoa que vai usar o sistema: você, a Camila, quem estiver no time comercial e no time de suporte acadêmico. Não tem limite de contas — crie uma por pessoa (assim fica registrado quem é quem; evite um login compartilhado).

### 3. Travar as regras do banco para só quem tiver login

Na aba **Regras (Rules)** do Firestore, substitua o conteúdo por:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /washington/{doc} {
      allow read, write: if request.auth != null;
    }
  }
}
```

e clique em **Publicar**. A partir daqui, só quem fez login (passo 2) consegue ler ou escrever os dados — sem login, o Firebase recusa.

### 4. Ligar o painel nesse projeto

1. Abra o arquivo `sync-config.js` deste site e troque `window.FIREBASE_CONFIG = null;` pela configuração copiada no passo 1.3, assim:
   ```js
   window.FIREBASE_CONFIG = {
     apiKey: "AIzaSy...",
     authDomain: "academia-washington.firebaseapp.com",
     projectId: "academia-washington",
     storageBucket: "academia-washington.appspot.com",
     messagingSenderId: "...",
     appId: "..."
   };
   ```
2. Suba o `sync-config.js` atualizado para o GitHub (substituindo o arquivo lá).

Pronto. Da próxima vez que alguém abrir o link do site, aparece uma tela de **Entrar** (e-mail e senha) antes de qualquer outra coisa. Quem não tiver conta cadastrada (passo 2.3) não consegue ver nada. Depois de entrar, em **Dados** aparece "Conectado como fulano@email.com" com um botão **Sair** — e as mudanças de qualquer pessoa aparecem para todo mundo em poucos segundos.

Se algum dia quiser desligar a sincronização (e o login junto com ela), volte o `sync-config.js` para `window.FIREBASE_CONFIG = null;`.

> Esqueceu a senha? Quem administra o Firebase (você) pode trocar a senha de qualquer pessoa em **Authentication › Users › (três pontinhos) › Reset password**, sem precisar de e-mail de recuperação configurado.

## Primeiro uso da equipe

1. Abrir **Professores** e preencher o telefone de cada um.
2. Ver a aba **Conferência** e resolver os choques e as turmas sem sala.
3. Em **Alunos**, cadastrar telefones conforme for falando com cada um (ou importar depois, se tiver a lista em algum lugar).
4. Em **Dados**, importar o primeiro relatório do Asaas para já ver a situação de pagamento de todo mundo.

# MyLingua

Plataforma pessoal para aprender idiomas, guardar descobertas e praticar com repetição espaçada. O MVP está organizado em frontend e backend separados e usa React/Vite, Express, SQLite, JWT e bcrypt.

## Requisitos

- Node.js 20 ou superior
- npm 10 ou superior

## Configuração

Na raiz do projeto:

```bash
npm install
```

Crie `backend/.env` a partir de `backend/.env.example` e defina um segredo JWT aleatório com pelo menos 24 caracteres. Exemplo:

```env
PORT=3001
JWT_SECRET=use-um-segredo-aleatorio-longo-aqui
DATABASE_PATH=./data/mylingua.db
```

O banco SQLite é criado automaticamente na primeira inicialização. Não há dados de demonstração; crie uma conta para começar.

### Primeiro administrador

Contas novas sempre recebem a função `user`; não existe cadastro público de administrador. Configure `ADMIN_NAME`, `ADMIN_EMAIL` e `ADMIN_PASSWORD` em `backend/.env`. Na inicialização, o backend cria a conta master ou sincroniza sua função e senha; a senha é armazenada no SQLite com bcrypt. O arquivo `.env` é local e não deve ser versionado.

Entre com o e-mail configurado e consulte a senha em `backend/.env`. A administração fica dispon�vel na navega��o dessa conta. O painel permite consultar usu�rios e indicadores e oferece configura��es gerais para pausar cadastros e habilitar ou desabilitar o �udio de estudo. Essas op��es afetam toda a aplica��o e s�o acess�veis somente a administradores. Admins veem somente a área administrativa; endpoints de idiomas, aprendizados e flashcards recusam contas admin. A API valida a função em cada requisição administrativa; administradores não podem alterar a própria função nem remover o último administrador.

## Executar

```bash
npm run dev
```

Frontend: http://localhost:5173  
API: http://localhost:3001/api  
Verificação da API: http://localhost:3001/api/health

Para gerar o frontend de produção, use `npm run build`. O backend pode ser iniciado separadamente com `npm start` dentro da pasta `backend`.

## Executar com Docker

Crie `backend/.env` conforme a seção de configuração e construa a imagem na raiz do projeto:

```bash
docker build -t mylingua .
docker run --name mylingua --env-file backend/.env -p 3001:3001 -v mylingua-data:/app/data mylingua
```

A interface e a API ficam disponíveis em http://localhost:3001. O volume `mylingua-data` mantém o banco SQLite entre reinicializações do contêiner. O arquivo `.env` e os bancos locais não são incluídos na imagem.

## Funcionalidades do MVP

- Cadastro e login com hash bcrypt e token JWT.
- Idiomas pessoais e níveis de proficiência.
- Biblioteca de aprendizados com busca, tradução, pronúncia, exemplos e tipo.
- Coleções e associação de aprendizados.
- Flashcards e sessões de revisão com intervalos baseados no algoritmo SM-2.
- Tela dedicada de estudo, atalhos de teclado e áudio de pronúncia sintetizado pelo navegador.
- Dashboard com métricas e atividade recente.
- Cadastro guiado no primeiro acesso, com criação de idioma, aprendizado e flashcard.
- Tema claro/escuro e layout responsivo.
- Navegação por teclado, foco visível, link para pular ao conteúdo e diálogos acessíveis.
- Manifest e service worker para instalação/cache inicial como PWA.

## Estrutura

```text
frontend/src/       Aplicação React e estilos
backend/src/        API, middleware e inicialização SQLite
backend/data/       Banco local criado em runtime (não versionado)
```

As tabelas são criadas idempotentemente na inicialização, com chaves estrangeiras, índices e escopo de usuário. Para publicar, configure um `JWT_SECRET` forte, `FRONTEND_URL`, HTTPS e uma política de backup do banco.

### Perfil e gestão de contas

Usuários acessam o perfil pelo atalho “Meu perfil” para consultar seus dados de cadastro e excluir a própria conta após confirmar a senha. Administradores podem desativar e reativar contas de usuários pelo painel; contas administrativas e a própria conta do administrador são protegidas. Contas desativadas não conseguem entrar e perdem acesso imediatamente.
### Controles de administracao

O painel oferece duracao de sessao para novos logins, tamanho minimo de senha para novas contas, limite diario de revisoes, controle de audio, pausa de cadastros e modo de manutencao somente leitura. O historico administrativo registra alteracoes de configuracao e ativacao/desativacao de contas.
### Assistente de idiomas com OpenAI

O administrador configura nome, modelo, instrucoes, mensagem inicial, temperatura, limite de resposta, ativacao e chave da OpenAI em Configuracoes. A chave e criptografada no banco e derivada de `JWT_SECRET`; mantenha esse segredo estavel ou sera necessario informar a chave novamente. O chat usa a Responses API da OpenAI, nao persiste o historico no MyLingua e envia no maximo as mensagens recentes da conversa.
The optional assistant schedule can be left blank for all-day availability or set as a daily start/end interval in an IANA timezone. Overnight intervals are supported.
O modo de teste do assistente fica no painel de configuracao do admin. Ele usa a configuracao salva mesmo quando o widget esta desativado ou fora do horario e envia cada teste a API OpenAI.
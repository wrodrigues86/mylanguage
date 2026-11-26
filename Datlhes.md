# Projeto: MyLingua — Plataforma pessoal de aprendizado

Atue como um desenvolvedor Full Stack Sênior e UI/UX Designer. Desenvolva uma aplicação web chamada **MyLingua**, uma plataforma pessoal para aprender idiomas, organizar conhecimentos e memorizar conteúdos utilizando repetição espaçada, inspirada no Anki, mas com uma experiência mais moderna e intuitiva.

## 1. Objetivo do projeto

Criar um ambiente onde o usuário possa:

- Aprender qualquer idioma.
- Salvar palavras, frases e expressões.
- Organizar seus aprendizados em coleções.
- Criar flashcards personalizados.
- Revisar conteúdos utilizando repetição espaçada.
- Acompanhar sua evolução.
- Construir uma biblioteca pessoal de conhecimento.

A aplicação deve ser preparada para futuramente suportar outros tipos de aprendizado além de idiomas.

## 2. Tecnologias obrigatórias

Frontend:
- ReactJS.
- Vite.
- JavaScript.
- React Router.
- Bootstrap 5.
- Axios.

Backend:
- Node.js.
- Express.
- SQLite.
- JWT para autenticação.
- bcrypt para senhas.

Arquitetura:
- Frontend e backend separados.
- API REST.
- Código organizado por módulos.
- Componentes reutilizáveis.
- Separação entre controllers, services e repositories.
- Variáveis de ambiente para configurações.

## 3. Identidade visual

Criar uma interface moderna, elegante e minimalista.

Referências visuais:
- Notion.
- Linear.
- Duolingo.
- Anki.

Características:
- Layout responsivo.
- Sidebar lateral.
- Dashboard organizado.
- Cards com bordas suaves.
- Ícones intuitivos.
- Tipografia moderna.
- Espaçamento confortável.
- Tema claro e escuro.
- Interface adaptada para celular e computador.

Evitar uma aparência infantil. O produto deve transmitir organização, produtividade e aprendizado.

## 4. Estrutura principal

Criar as seguintes páginas:

### Dashboard
Exibir:
- Total de idiomas cadastrados.
- Total de palavras aprendidas.
- Total de flashcards.
- Revisões pendentes.
- Sequência de dias estudados.
- Gráfico de evolução.
- Atividades recentes.
- Botão para iniciar revisão.

### Meus idiomas
Permitir:
- Adicionar idiomas.
- Editar idiomas.
- Excluir idiomas.
- Definir idioma nativo.
- Definir idioma que deseja aprender.
- Definir nível de conhecimento.
- Visualizar progresso individual.

### Minha biblioteca
Principal funcionalidade da aplicação.

Permitir salvar:
- Palavras.
- Frases.
- Expressões.
- Verbos.
- Gramática.
- Anotações.

Cada aprendizado deve possuir:
- Título ou palavra.
- Tradução.
- Pronúncia.
- Descrição.
- Exemplo de utilização.
- Categoria.
- Etiquetas.
- Idioma relacionado.
- Data de criação.
- Imagem ou áudio opcional.

Implementar pesquisa, filtros e paginação.

### Coleções
Permitir criar coleções personalizadas para organizar os conteúdos.

Exemplos:
- Japonês básico.
- Inglês para viagens.
- Verbos em inglês.
- Expressões do cotidiano.
- Gramática japonesa.

Permitir adicionar um mesmo aprendizado a diferentes coleções.

### Flashcards
Criar sistema de cartões com:
- Frente e verso.
- Pergunta e resposta.
- Tradução.
- Exemplos.
- Áudio opcional.

Permitir criar cartões manualmente a partir dos conteúdos da biblioteca.

### Sistema de revisão
Implementar repetição espaçada utilizando um algoritmo baseado no SM-2.

Após visualizar um cartão, o usuário poderá classificar sua dificuldade:
- Errei.
- Difícil.
- Bom.
- Fácil.

O sistema deverá:
- Calcular a próxima revisão.
- Registrar o histórico.
- Atualizar os intervalos.
- Identificar cartões atrasados.
- Exibir a quantidade de revisões pendentes.

Não utilizar apenas uma sequência fixa de datas. O intervalo deve considerar o desempenho do usuário.

### Estatísticas
Exibir:
- Palavras aprendidas.
- Cartões revisados.
- Taxa de acertos.
- Dias estudados.
- Evolução por idioma.
- Histórico de atividades.

## 5. Banco de dados

Criar um banco SQLite com tabelas organizadas:

- users
- languages
- user_languages
- learnings
- categories
- tags
- learning_tags
- collections
- collection_learnings
- flashcards
- review_history
- study_sessions

Todas as informações pessoais devem estar relacionadas ao usuário autenticado.

Criar migrations ou um mecanismo organizado para inicialização e atualização do banco.

Adicionar índices e relacionamentos com chaves estrangeiras.

## 6. Segurança

Implementar:
- Cadastro de usuários.
- Login.
- Senhas criptografadas com bcrypt.
- Autenticação JWT.
- Rotas protegidas.
- Validação dos dados recebidos.
- Tratamento centralizado de erros.
- Proteção para impedir acesso aos dados de outros usuários.

## 7. Experiência do usuário

A aplicação deve ser simples de utilizar.

O usuário deve conseguir adicionar um novo aprendizado rapidamente, sem preencher muitos campos obrigatórios.

Criar:
- Modais para cadastro rápido.
- Feedback visual de sucesso e erro.
- Estados de carregamento.
- Telas vazias com orientações.
- Confirmação antes de excluir informações.
- Navegação intuitiva.

## 8. PWA

Preparar a aplicação para funcionar como PWA:
- Manifest.
- Ícones.
- Instalação no celular.
- Service Worker.
- Cache dos recursos estáticos.
- Estrutura preparada para sincronização futura.

## 9. Organização do projeto

Utilizar uma estrutura semelhante a:

frontend/
  src/
    components/
    pages/
    layouts/
    services/
    hooks/
    contexts/
    routes/
    styles/

backend/
  src/
    controllers/
    services/
    repositories/
    routes/
    middlewares/
    database/
    migrations/
    utils/

Criar componentes reutilizáveis e manter a lógica de negócio fora dos componentes visuais.

## 10. Regras de desenvolvimento

- Não criar apenas telas estáticas.
- Todas as funcionalidades principais devem funcionar.
- Implementar frontend conectado à API.
- Persistir os dados no SQLite.
- Não utilizar dados fictícios como substitutos das funcionalidades reais.
- Criar validações no frontend e backend.
- Evitar duplicação de código.
- Manter o código simples e fácil de manter.
- Não implementar funcionalidades complexas antes de concluir o MVP.

## 11. Ordem de implementação

Desenvolver em etapas:

1. Criar a estrutura frontend e backend.
2. Configurar SQLite e banco de dados.
3. Implementar cadastro e autenticação.
4. Criar layout e identidade visual.
5. Implementar gerenciamento de idiomas.
6. Implementar biblioteca de aprendizados.
7. Implementar coleções.
8. Implementar flashcards.
9. Implementar repetição espaçada.
10. Implementar dashboard e estatísticas.
11. Preparar PWA.

Ao finalizar cada etapa:
- Verificar se tudo funciona.
- Corrigir erros.
- Testar integração entre frontend e backend.
- Atualizar o README.

## 12. Resultado esperado

Entregar uma aplicação funcional, responsiva e organizada, com identidade visual própria.

O projeto deve ser desenvolvido como um produto real, preparado para receber novos usuários e evoluir futuramente para um SaaS com planos gratuitos e premium.

Comece pela arquitetura, estrutura de pastas e banco de dados. Depois desenvolva cada etapa na ordem definida.

Antes de finalizar, apresente instruções para instalar dependências, configurar o ambiente e executar frontend e backend.
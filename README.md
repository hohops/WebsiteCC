# Quiz Diário de Ciência

Projeto simples em HTML/CSS/JS para exibir uma pergunta diária de ciências em português, permitir que alunos entrem com um nome, respondam e acumulem pontos. Admins podem adicionar novas perguntas (local demo).

Como funciona (local):

- Dados são salvos no `localStorage` do navegador.
- Cada usuário tem um nome; pontos aumentam +1 quando a resposta do dia está correta. Respostas erradas dão +0.
- Um usuário só pode responder uma vez por dia (controle por data no perfil).
- A pergunta do dia é escolhida de forma determinística pela data (rotaciona entre as perguntas disponíveis).

Arquivos:

- `index.html` — página principal.
- `styles.css` — estilos.
- `script.js` — lógica do frontend (armazenamento local, autenticação simples, admin, placar).
- `db.sql` — esquema SQL para Supabase/Postgres com tabelas `profiles`, `questions` e `answers`.

Observações sobre login:

- Agora o site pede **nome** e **senha** ao entrar. Em implementação local a senha é salva no `localStorage` (INSEGURO). Para produção, use autenticação real (Supabase Auth, Firebase Auth, etc.) e nunca armazene senhas em texto puro.

Executar localmente:

1. Abra `index.html` em um navegador moderno.
2. No campo "Seu nome de usuário" digite um nome e clique "Entrar / Registrar".
3. Responda a pergunta do dia — se correta, ganha +1 ponto.
4. Para o admin: use o token `admin123` (demonstração) no painel do admin para habilitar o formulário de adicionar perguntas.

Produção com Supabase (opcional):

1. Crie um projeto no Supabase.
2. Abra o SQL Editor e execute `db.sql` para criar as tabelas.
3. Implemente endpoints ou use Supabase client para:
   - buscar a pergunta do dia (SELECT ... ORDER BY id LIMIT 1 OFFSET <n>)
   - criar perfis e atualizar pontos
   - registrar respostas em `answers`
4. Substitua as chamadas `localStorage` do `script.js` por chamadas HTTP/Supabase.

Notas de segurança:

- O token admin embutido em `script.js` é apenas para demonstração. Em produção, implemente autenticação real e proteja as rotas de administração.

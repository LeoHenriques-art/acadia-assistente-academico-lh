# ACADIA - Assistente Académico Inteligente

## Descrição

ACADIA é uma plataforma completa de assistência académica com agentes especializados em diferentes áreas do trabalho académico:

- **Leitor de PFCs**: Análise e extração de conteúdo de documentos académicos
- **Orientador IA**: Assistência personalizada para projetos académicos
- **Revisor Científico**: Revisão profissional com editor inline e validação
- **Especialista em Metodologia**: Construtor passo a passo de metodologias científicas
- **Analista de Dados Académico**: Análise estatística com upload de datasets e gráficos automáticos

## Tecnologias

- **Frontend**: React + TypeScript + Vite
- **Backend**: Supabase (PostgreSQL + Functions)
- **UI**: TailwindCSS + Shadcn/ui
- **IA**: Google Gemini API
- **Deploy**: Vercel/Netlify (recomendado)

## Instalação Local

```bash
# Clonar repositório
git clone <repositório-url>
cd syllabus-companion-ai-main

# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas chaves do Supabase

# Iniciar desenvolvimento
npm run dev
```

## Deploy

### Opção 1: Vercel (Recomendado)

1. Criar conta em [Vercel](https://vercel.com)
2. Conectar repositório Git
3. Configurar variáveis de ambiente no Vercel
4. Deploy automático

### Opção 2: Netlify

1. Criar conta em [Netlify](https://netlify.com)
2. Arrastar pasta do projeto ou conectar Git
3. Configurar build command: `npm run build`
4. Configurar publish directory: `dist`

### Opção 3: GitHub Pages

```bash
# Build para produção
npm run build

# Deploy para gh-pages
npm run deploy
```

## Configuração Necessária

### Variáveis de Ambiente

```env
VITE_SUPABASE_URL=sua-url-supabase
VITE_SUPABASE_ANON_KEY=sua-chave-anonima
```

### Supabase Setup

1. Criar projeto em [Supabase](https://supabase.com)
2. Rodar migrations na pasta `supabase/migrations/`
3. Configurar Edge Functions em `supabase/functions/`
4. Ativar autenticação e configurar políticas

## Funcionalidades

### 📚 Leitor de PFCs
- Upload de PDFs
- Extração automática de texto
- Análise de estrutura
- Geração de resumos

### 🎓 Orientador IA
- Consultoria personalizada
- Sugestões de conteúdo
- Planeamento de projetos
- Feedback contínuo

### ✏️ Revisor Científico
- Editor com sugestões inline
- Comparação de versões
- Score de qualidade
- Validação académica

### 🔬 Especialista em Metodologia
- Construtor passo a passo
- Templates de investigação
- Validação automática
- Referências metodológicas

### 📊 Analista de Dados
- Upload de CSV/Excel
- Estatísticas descritivas
- Gráficos automáticos
- Interpretação científica

## Licença

MIT License - Ver arquivo LICENSE para detalhes

## Suporte

Para suporte, abrir issue no GitHub ou contactar equipa de desenvolvimento.

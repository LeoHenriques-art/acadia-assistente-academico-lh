# 🚀 Guia Completo: Deploy ACADIA no Vercel

## 📋 Pré-requisitos

- Conta no [GitHub](https://github.com)
- Conta no [Vercel](https://vercel.com)
- Repositório Git configurado localmente

---

## 🔧 Passo 1: Criar Repositório no GitHub

### 1.1 Acessar GitHub
1. Faça login em [github.com](https://github.com)
2. Clique em "+" no canto superior direito
3. Selecione "New repository"

### 1.2 Configurar Repositório
```
Repository name: acadia-assistente-academico
Description: Assistente Académico Inteligente com IA
☑️ Public (para deploy gratuito)
☑️ Add a README file
☑️ Add .gitignore (Node)
☐ License (opcional)
```

### 1.3 Anotar URL do Repositório
Após criar, o GitHub mostrará:
```
https://github.com/SEU_USERNAME/acadia-assistente-academico.git
```

---

## 🔄 Passo 2: Conectar Repositório Local ao GitHub

### 2.1 Configurar Remote (substitua SEU_USERNAME)
```bash
git remote add origin https://github.com/SEU_USERNAME/acadia-assistente-academico.git
git branch -M main
git push -u origin main
```

### 2.2 Se Pedir Credenciais
- Username: seu email do GitHub
- Password: use **Personal Access Token** (não senha)
  - Settings → Developer settings → Personal access tokens → Generate new token
  - Marque "repo" e "workflow"

---

## 🌐 Passo 3: Deploy no Vercel

### 3.1 Acessar Vercel
1. Faça login em [vercel.com](https://vercel.com)
2. Clique em "Continue with GitHub"

### 3.2 Importar Repositório
1. Clique em "Add New..." → "Project"
2. Procure "acadia-assistente-academico"
3. Clique em "Import"

### 3.3 Configurar Deploy
Vercel detectará automaticamente:
```
Framework: Vite
Build Command: npm run build
Output Directory: dist/client
Install Command: npm install
Root Directory: ./
```

### 3.4 Configurar Variáveis de Ambiente
Clique em "Environment Variables" e adicione:

```
VITE_SUPABASE_URL = https://SEU_PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY = SUA_CHAVE_ANONIMA
```

**Como obter essas chaves:**
1. Acesse [supabase.com](https://supabase.com)
2. Entre no seu projeto
3. Settings → API
4. Copie "Project URL" e "anon public"

### 3.5 Fazer Deploy
1. Clique em "Deploy"
2. Aguarde o processo (2-3 minutos)
3. Vercel fornecerá URL: `https://acadia-assistente-academico.vercel.app`

---

## ✅ Passo 4: Verificar Deploy

### 4.1 Testar Funcionalidades
- ✅ Página carrega corretamente
- ✅ Login com Supabase funciona
- ✅ Upload de PDFs funciona
- ✅ Agentes respondem

### 4.2 Se Alguma Coisa Der Errado

**Erro 404:**
- Verifique se `vercel.json` está correto
- Confirme `outputDirectory: dist/client`

**Erro de Supabase:**
- Verifique variáveis de ambiente
- Confirme CORS settings no Supabase

**Build Error:**
- Verifique se `package.json` tem script "build"
- Confirme se todas dependências estão instaladas

---

## 🔄 Passo 5: Deploy Automático

### 5.1 Configurar Deploy Contínuo
Vercel já configurou automaticamente:
- Cada `git push` dispara novo deploy
- Deploy preview para cada PR
- Deploy automático para branch main

### 5.2 Customizar Domínio (Opcional)
1. Dashboard Vercel → Project → Settings → Domains
2. Adicionar domínio personalizado
3. Configurar DNS conforme instruções

---

## 🛠️ Soluções Alternativas

### Se Vercel Não Funcionar:

**Netlify (mais simples):**
1. Acesse [netlify.com](https://netlify.com)
2. Arraste pasta do projeto
3. Configure:
   - Build command: `npm run build`
   - Publish directory: `dist/client`

**GitHub Pages (gratuito):**
1. Configure GitHub Actions
2. Use workflow para build automático
3. Deploy para branch `gh-pages`

---

## 📞 Suporte

**Documentação:**
- [Vercel Docs](https://vercel.com/docs)
- [Supabase Docs](https://supabase.com/docs)

**Comandos Úteis:**
```bash
# Verificar build local
npm run build

# Testar preview local
npm run preview

# Verificar logs de deploy
vercel logs

# Deploy via CLI
vercel --prod
```

---

## ✅ Checklist Final

- [ ] Repositório no GitHub criado
- [ ] Código enviado para GitHub
- [ ] Projeto importado no Vercel
- [ ] Variáveis de ambiente configuradas
- [ ] Deploy realizado com sucesso
- [ ] Funcionalidades testadas
- [ ] URL pública funcionando

**Resultado esperado:** `https://acadia-assistente-academico.vercel.app`

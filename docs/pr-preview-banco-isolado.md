# PR — Ambiente de Preview com Banco Isolado

## Contexto

O pipeline de CD realizava deploy de preview na Vercel e executava os testes E2E contra esse ambiente — porém, tanto preview quanto produção apontavam para o **mesmo projeto Supabase**. Isso significava que cada execução do pipeline criava pedidos no banco de produção.

Além disso, o job `promote` usava `vercel promote`, que **reutiliza o bundle de preview** sem gerar um novo build. Como as variáveis `VITE_*` são embutidas pelo Vite em tempo de build, o bundle de preview carregava as URLs do Supabase de preview — e ao promover esse build para produção, a aplicação continuaria falando com o banco errado.

---

## O que foi feito

### 1. Dois projetos Supabase distintos

| Ambiente | Projeto Supabase |
|---|---|
| Produção | `nkndeikytdtunhboideu` |
| Preview | `ktalortnuqzjlcqsofzh` |

Migrações e Edge Functions foram aplicadas nos dois projetos via CLI do Supabase, mantendo estrutura e políticas de RLS idênticas.

### 2. Variáveis de ambiente na Vercel separadas por ambiente

As variáveis `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e `VITE_SUPABASE_PROJECT_ID` foram configuradas separadamente nos ambientes **Preview** e **Production** da Vercel, cada uma apontando para o respectivo projeto Supabase.

> **Atenção:** essas variáveis **não devem ser marcadas como Sensitive** na Vercel. Variáveis Sensitive não são baixadas pelo `vercel pull`, impedindo que o `vercel build` no CI as inclua no bundle. Como variáveis `VITE_*` já são emitidas literalmente no JavaScript servido ao browser, marcá-las como Sensitive não adiciona proteção real.

### 3. `DATABASE_URL` no CI via GitHub Secret

O `orderRepository.ts` usa Kysely/pg para conectar diretamente ao banco em operações de setup e teardown dos testes. Como o arquivo `.env` não é commitado, essa variável precisava estar disponível no runner do GitHub Actions.

**Solução:** criar o GitHub Secret `DATABASE_URL_PREVIEW` e injetá-lo no job `e2e-tests`:

```yaml
- name: Run E2E Regression Tests
  run: yarn playwright test
  env:
    BASE_URL: ${{ needs.build-and-deploy.outputs.deployment-url }}
    DATABASE_URL: ${{ secrets.DATABASE_URL_PREVIEW }}
```

> O `DATABASE_URL` é usado **somente pelo Playwright no CI**. A aplicação Vercel nunca usa essa variável — ela se comunica com o Supabase via HTTPS usando as variáveis `VITE_SUPABASE_*`.

### 4. Rebuild de produção no job `promote`

#### Caminhos avaliados

| Abordagem | Descrição | Resultado em produção |
|---|---|---|
| `vercel promote` | Re-aponta o domínio para o build de preview existente | Bundle com Supabase de **preview** ❌ |
| **Rebuild com `--prod`** | Novo `vercel pull --environment=production` + `vercel build --prod` + `vercel deploy --prod` | Bundle com Supabase de **produção** ✅ |

#### Escolha: Rebuild completo para produção

O job `promote` foi substituído por um rebuild completo que:

1. Executa `vercel pull --environment=production` — baixa as variáveis `VITE_SUPABASE_*` de produção
2. Executa `vercel build --prod` — gera um novo bundle com as URLs de produção embutidas
3. Executa `vercel deploy --prebuilt --prod` — envia o build correto para o domínio de produção

**Motivo da escolha:** é a abordagem mais explícita e segura. Cada ambiente tem seu próprio build gerado com as variáveis corretas. Não há reaproveitamento de artefatos entre ambientes, eliminando qualquer risco de contaminação de configuração.

> **Alternativa considerada:** usar `vercel build --prod` direto no step de promote e nunca acionar `vercel promote`. A escolha pelo rebuild completo (pull → build → deploy) é mais explícita e segura, já que os steps de cada ambiente ficam evidentes e independentes no workflow, facilitando auditoria e manutenção futura.

---

## Secrets e variáveis — onde vive cada uma

| Variável | Onde vive |
|---|---|
| `VITE_SUPABASE_URL` | Vercel Environment Variables (por ambiente) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Vercel Environment Variables (por ambiente) |
| `VITE_SUPABASE_PROJECT_ID` | Vercel Environment Variables (por ambiente) |
| `DATABASE_URL_PREVIEW` | GitHub Secrets |
| `DATABASE_URL_PRODUCTION` | GitHub Secrets |
| `VERCEL_TOKEN` | GitHub Secrets |
| `VERCEL_PROJECT_ID` | GitHub Secrets |
| `VERCEL_ORG_ID` | GitHub Secrets |

O arquivo `.env` está no `.gitignore` e foi removido do tracking do Git via `git rm --cached .env`. Nenhuma credencial foi commitada no repositório.

---

## Critérios de Aceitação

- [x] Existem dois projetos Supabase distintos, um para preview e outro para produção
- [x] Um pedido criado durante a execução dos testes E2E não aparece no banco de produção
- [x] Após o promote, a aplicação em produção lê e escreve no banco de produção
- [x] Os testes E2E continuam passando no pipeline
- [x] As migrações e Edge Functions estão sincronizadas entre os dois projetos
- [x] As secrets/variáveis sensíveis não foram commitadas no repositório

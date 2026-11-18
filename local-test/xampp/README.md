# Ambiente Secundário de Testes Locais — XAMPP / MariaDB

Este diretório contém o suporte exclusivo para executar a **DevEssent Platform** em ambiente de desenvolvimento local leve usando **XAMPP (MySQL/MariaDB)** sem necessidade de Docker ou conexão ao Supabase Cloud.

> **Aviso Importante:** Este ambiente é exclusivamente para testes funcionais cotidianos. A infraestrutura oficial e definitiva de produção da plataforma continua sendo **Supabase (PostgreSQL, Auth, RLS, Storage e RBAC)**.

---

## Pré-requisitos
1. XAMPP instalado com o serviço **MySQL / MariaDB** iniciado no Painel de Controle do XAMPP (`127.0.0.1:3306`).
2. Variáveis configuradas no `.env.local` (ou passadas pelo script):
   ```dotenv
   APP_BACKEND_MODE=xampp-test
   XAMPP_DB_HOST=127.0.0.1
   XAMPP_DB_PORT=3306
   XAMPP_DB_USER=root
   XAMPP_DB_PASSWORD=
   XAMPP_DB_NAME=devessent_test
   XAMPP_SESSION_SECRET=dev-xampp-local-session-secret-change-me-32chars
   ```

## Comandos

1. **Criar o banco `devessent_test` e tabelas no MariaDB:**
   ```powershell
   pnpm xampp:migrate
   ```
2. **Popular contas e empresas demonstrativas:**
   ```powershell
   pnpm xampp:seed
   ```
3. **Iniciar a aplicação Next.js no modo XAMPP (sem Docker):**
   ```powershell
   pnpm dev:xampp
   ```
4. **Executar os testes unitários/funcionais do adaptador XAMPP:**
   ```powershell
   pnpm test:xampp
   ```


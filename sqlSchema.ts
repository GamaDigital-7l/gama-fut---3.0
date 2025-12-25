
/**
 * ARQUIVO DE DEFINIÇÃO DOS SCRIPTS SQL
 * 
 * ATENÇÃO: ESTE É UM ARQUIVO TYPESCRIPT (.ts).
 * NÃO COPIE O CONTEÚDO DESTE ARQUIVO DIRETO PARA O SQL EDITOR DO SUPABASE.
 * 
 * O código SQL correto está DENTRO das strings (entre as crases `).
 * Use a página /setup do aplicativo para copiar o SQL limpo.
 */

export const SQL_RESET_SCRIPT = `
-- ATENÇÃO: ESTE SCRIPT APAGA TODOS OS DADOS DO SISTEMA

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

DROP TABLE IF EXISTS admin_audit_logs CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS global_sponsors CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS plans CASCADE;
DROP TABLE IF EXISTS sponsors CASCADE;
DROP TABLE IF EXISTS news CASCADE;
DROP TABLE IF EXISTS match_events CASCADE;
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS players CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS groups CASCADE;
DROP TABLE IF EXISTS championships CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;
DROP TABLE IF EXISTS venues CASCADE;

-- Limpeza de Buckets
DELETE FROM storage.objects WHERE bucket_id IN ('championship-logos', 'team-logos', 'sponsor-logos', 'regulations');
DELETE FROM storage.buckets WHERE id IN ('championship-logos', 'team-logos', 'sponsor-logos', 'regulations');

-- Atualiza o cache do PostgREST
NOTIFY pgrst, 'reload config';
`;

export const SQL_FIX_ADMIN_SCRIPT = `
-- ==============================================================================
-- SCRIPT DE CORREÇÃO MANUAL DE ADMIN
-- Use isso se você já criou a conta mas não tem acesso ao painel.
-- ==============================================================================

DO $$
DECLARE
    -- SEU EMAIL AQUI:
    target_email TEXT := 'gustavogama099@gmail.com';
    
    target_org_id UUID := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'; -- ID da Organização Padrão
    v_user_id UUID;
BEGIN
    -- 1. Garante que as colunas necessárias existam (caso o setup tenha falhado)
    ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
    ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS role TEXT;
    
    -- 2. Pega o ID do usuário pelo email
    SELECT id INTO v_user_id FROM auth.users WHERE email = target_email;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário % não encontrado. Crie a conta no site primeiro.', target_email;
    ELSE
        -- 3. Garante que a organização existe
        INSERT INTO public.organizations (id, name, slug, logo_url)
        VALUES (target_org_id, 'Liga GAMA Oficial', 'gama-league', 'https://via.placeholder.com/150/059669/ffffff?text=GAMA')
        ON CONFLICT (id) DO NOTHING;

        -- 4. Insere ou Atualiza o Perfil para Super Admin
        INSERT INTO public.user_profiles (id, organization_id, full_name, role, status)
        VALUES (v_user_id, target_org_id, 'Admin GAMA', 'super_admin', 'active')
        ON CONFLICT (id) DO UPDATE
        SET role = 'super_admin',
            organization_id = target_org_id,
            status = 'active';
            
        RAISE NOTICE 'SUCESSO: Permissão de Admin concedida para %', target_email;
    END IF;
END $$;
`;

export const SQL_FIX_CASCADE_SCRIPT = `
-- ==============================================================================
-- CORREÇÃO DE INTEGRIDADE (CASCADE DELETE)
-- Execute este script se estiver com erro ao excluir clientes/organizações.
-- ==============================================================================

-- 1. Subscriptions (Assinaturas)
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_organization_id_fkey;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- 2. User Profiles (Usuários)
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_organization_id_fkey;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- 3. Championships (Campeonatos)
ALTER TABLE championships DROP CONSTRAINT IF EXISTS championships_organization_id_fkey;
ALTER TABLE championships ADD CONSTRAINT championships_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- 4. Teams (Times)
ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_organization_id_fkey;
ALTER TABLE teams ADD CONSTRAINT teams_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- 5. News (Notícias)
ALTER TABLE news DROP CONSTRAINT IF EXISTS news_organization_id_fkey;
ALTER TABLE news ADD CONSTRAINT news_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- 6. Matches (Jogos)
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_organization_id_fkey;
ALTER TABLE matches ADD CONSTRAINT matches_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- GARANTIR UNICIDADE DA ASSINATURA (Evita array de assinatura)
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_organization_id_key;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_organization_id_key UNIQUE (organization_id);

NOTIFY pgrst, 'reload config';
`;

export const SQL_UPDATE_WO_VENUES_SCRIPT = `
-- ==============================================================================
-- ATUALIZAÇÃO 1.1: LOCAIS (CAMPOS), W.O. E PÊNALTIS
-- Execute este script para habilitar as novas funcionalidades.
-- ==============================================================================

-- 1. Criar Tabela de Locais (Venues)
CREATE TABLE IF NOT EXISTS venues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Habilitar RLS para venues
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public venues" ON venues; 
CREATE POLICY "Public venues" ON venues FOR ALL USING (true);

-- 2. Atualizar Tabela de Jogos (Matches) com novos campos
ALTER TABLE matches ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES venues(id);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS penalty_home_score INTEGER;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS penalty_away_score INTEGER;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS is_wo BOOLEAN DEFAULT FALSE;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS wo_winner_team_id UUID REFERENCES teams(id);

NOTIFY pgrst, 'reload config';
`;

export const SQL_PERFORMANCE_SCRIPT = `
-- ==============================================================================
-- OTIMIZAÇÃO DE PERFORMANCE (ÍNDICES)
-- Execute este script para acelerar o carregamento de tabelas e jogos.
-- ==============================================================================

-- 1. Índices para Chaves Estrangeiras (Consultas Relacionais)
-- Acelera buscas como: "Todos os times de um campeonato"
CREATE INDEX IF NOT EXISTS idx_championships_org ON championships(organization_id);
CREATE INDEX IF NOT EXISTS idx_teams_champ ON teams(championship_id);
CREATE INDEX IF NOT EXISTS idx_teams_org ON teams(organization_id);
CREATE INDEX IF NOT EXISTS idx_groups_champ ON groups(championship_id);

-- Acelera buscas de Elenco e Estatísticas
CREATE INDEX IF NOT EXISTS idx_players_team ON players(team_id);

-- Acelera buscas de Jogos e Calendário
CREATE INDEX IF NOT EXISTS idx_matches_champ ON matches(championship_id);
CREATE INDEX IF NOT EXISTS idx_matches_org ON matches(organization_id);
CREATE INDEX IF NOT EXISTS idx_matches_teams ON matches(home_team_id, away_team_id);
CREATE INDEX IF NOT EXISTS idx_matches_start_time ON matches(start_time); -- Ordenação por data

-- Acelera Artilharia e Súmulas
CREATE INDEX IF NOT EXISTS idx_match_events_match ON match_events(match_id);
CREATE INDEX IF NOT EXISTS idx_match_events_player ON match_events(player_id);

-- Acelera Login e Perfis
CREATE INDEX IF NOT EXISTS idx_user_profiles_org ON user_profiles(organization_id);

-- 3. Verifica integridade básica do RLS (Segurança)
-- Garante que o RLS está ativo em todas as tabelas principais
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE championships ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Recarrega configurações do banco
NOTIFY pgrst, 'reload config';
`;

export const SQL_RLS_FIX_SCRIPT = `
-- ==============================================================================
-- REPARO DE PERMISSÕES (RLS - ROW LEVEL SECURITY)
-- Use este script se as páginas públicas estiverem vazias ou dando erro de acesso.
-- Este script redefine as políticas para permitir LEITURA e ESCRITA pública (Modo Permissivo)
-- ==============================================================================

-- 1. Forçar Habilitação do RLS em todas as tabelas
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE championships ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE news ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- 2. Remover Políticas Antigas (Limpeza)
DROP POLICY IF EXISTS "Public organizations" ON organizations;
DROP POLICY IF EXISTS "Public championships" ON championships;
DROP POLICY IF EXISTS "Public teams" ON teams;
DROP POLICY IF EXISTS "Public matches" ON matches;
DROP POLICY IF EXISTS "Public players" ON players;
DROP POLICY IF EXISTS "Public match_events" ON match_events;
DROP POLICY IF EXISTS "Public news" ON news;
DROP POLICY IF EXISTS "Public sponsors" ON sponsors;
DROP POLICY IF EXISTS "Public global_sponsors" ON global_sponsors;
DROP POLICY IF EXISTS "Public user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Public audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "Public venues" ON venues;
DROP POLICY IF EXISTS "Public groups" ON groups;
DROP POLICY IF EXISTS "Public plans" ON plans;
DROP POLICY IF EXISTS "Public subscriptions" ON subscriptions;

-- 3. Criar Políticas Permissivas (ALL = SELECT, INSERT, UPDATE, DELETE)
-- Nota: Isso permite que qualquer pessoa com a chave Anon leia/escreva.
-- Ideal para demos ou apps onde o controle de acesso é feito no front/middleware.
CREATE POLICY "Public organizations" ON organizations FOR ALL USING (true);
CREATE POLICY "Public championships" ON championships FOR ALL USING (true);
CREATE POLICY "Public teams" ON teams FOR ALL USING (true);
CREATE POLICY "Public matches" ON matches FOR ALL USING (true);
CREATE POLICY "Public players" ON players FOR ALL USING (true);
CREATE POLICY "Public match_events" ON match_events FOR ALL USING (true);
CREATE POLICY "Public news" ON news FOR ALL USING (true);
CREATE POLICY "Public sponsors" ON sponsors FOR ALL USING (true);
CREATE POLICY "Public global_sponsors" ON global_sponsors FOR ALL USING (true);
CREATE POLICY "Public user_profiles" ON user_profiles FOR ALL USING (true);
CREATE POLICY "Public audit_logs" ON audit_logs FOR ALL USING (true);
CREATE POLICY "Public venues" ON venues FOR ALL USING (true);
CREATE POLICY "Public groups" ON groups FOR ALL USING (true);
CREATE POLICY "Public plans" ON plans FOR ALL USING (true);
CREATE POLICY "Public subscriptions" ON subscriptions FOR ALL USING (true);

-- Recarrega configurações do banco
NOTIFY pgrst, 'reload config';
`;

export const SQL_SETUP_SCRIPT = `
-- ==============================================================================
-- INICIO DO SCRIPT SQL (SETUP V7 - SAAS FEATURES + CASCADE)
-- Copie APENAS o texto deste editor para o Supabase SQL Editor.
-- ==============================================================================

-- 0. CORREÇÃO DE TIPAGEM (PRE-FLIGHT CHECK)
DO $$
DECLARE
    col_type text;
BEGIN
    SELECT data_type INTO col_type 
    FROM information_schema.columns 
    WHERE table_name = 'plans' AND column_name = 'id' AND table_schema = 'public';

    IF col_type IS NOT NULL AND col_type != 'uuid' THEN
        RAISE NOTICE 'Detectado tipo incorreto em plans.id (%). Recriando tabelas...', col_type;
        DROP TABLE IF EXISTS subscriptions CASCADE;
        DROP TABLE IF EXISTS plans CASCADE;
    END IF;
    
    SELECT data_type INTO col_type 
    FROM information_schema.columns 
    WHERE table_name = 'subscriptions' AND column_name = 'plan_id' AND table_schema = 'public';
    
    IF col_type IS NOT NULL AND col_type != 'uuid' THEN
        RAISE NOTICE 'Detectado tipo incorreto em subscriptions.plan_id. Recriando tabela...';
        DROP TABLE IF EXISTS subscriptions CASCADE;
    END IF;
END $$;

-- 1. LIMPEZA PREVENTIVA
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 3. CRIAÇÃO DE TABELAS
CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT,
    price_monthly NUMERIC(10, 2) DEFAULT 0,
    price_yearly NUMERIC(10, 2) DEFAULT 0,
    limits JSONB DEFAULT '{"championships": 1, "teams_per_championship": 8, "users": 1}'::jsonb,
    features JSONB DEFAULT '[]'::jsonb,
    description TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT,
    slug TEXT UNIQUE,
    logo_url TEXT,
    owner_id UUID,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Tabela de Locais/Campos (NOVO)
CREATE TABLE IF NOT EXISTS venues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- REGRAS DE CASCADE NO SETUP INICIAL
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES plans(id),
    status TEXT CHECK (status IN ('trial', 'active', 'warning', 'overdue', 'blocked', 'canceled')) DEFAULT 'trial',
    start_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    end_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now() + interval '14 days'),
    custom_limits JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    CONSTRAINT subscriptions_organization_id_key UNIQUE (organization_id)
);

CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    full_name TEXT,
    role TEXT CHECK (role IN ('super_admin', 'organizer_admin', 'mesario', 'tecnico', 'torcedor')),
    avatar_url TEXT,
    phone TEXT,
    team_id UUID,
    status TEXT CHECK (status IN ('active', 'blocked')) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS championships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT,
    slug TEXT,
    season TEXT,
    category TEXT,
    city TEXT,
    state TEXT,
    description TEXT,
    status TEXT CHECK (status IN ('rascunho', 'publicado', 'encerrado')) DEFAULT 'rascunho',
    logo_url TEXT,
    banner_url TEXT,
    primary_color TEXT DEFAULT '#10B981',
    secondary_color TEXT DEFAULT '#FFFFFF',
    start_date DATE,
    end_date DATE,
    points_win INTEGER DEFAULT 3,
    points_draw INTEGER DEFAULT 1,
    points_loss INTEGER DEFAULT 0,
    tiebreakers JSONB DEFAULT '["wins", "goal_diff", "goals_for"]'::jsonb,
    zone_config JSONB DEFAULT '{"promotion": 4, "relegation": 1, "gold": 0, "silver": 0, "bronze": 0, "mode": "traditional"}'::jsonb,
    views_page INTEGER DEFAULT 0,
    views_table INTEGER DEFAULT 0,
    regulations_url TEXT,
    regulations_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    championship_id UUID REFERENCES championships(id) ON DELETE CASCADE,
    name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    championship_id UUID REFERENCES championships(id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id),
    name TEXT,
    short_name TEXT,
    logo_url TEXT,
    coach_name TEXT,
    category TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    name TEXT,
    number INTEGER,
    position TEXT,
    photo_url TEXT,
    letter TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    championship_id UUID REFERENCES championships(id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id),
    home_team_id UUID REFERENCES teams(id),
    away_team_id UUID REFERENCES teams(id),
    start_time TIMESTAMP WITH TIME ZONE,
    status TEXT CHECK (status IN ('scheduled', 'live', 'finished', 'postponed')) DEFAULT 'scheduled',
    home_score INTEGER DEFAULT 0,
    away_score INTEGER DEFAULT 0,
    
    -- NOVOS CAMPOS
    penalty_home_score INTEGER,
    penalty_away_score INTEGER,
    is_wo BOOLEAN DEFAULT FALSE,
    wo_winner_team_id UUID REFERENCES teams(id),
    venue_id UUID REFERENCES venues(id),

    location TEXT,
    round_number INTEGER,
    stage TEXT DEFAULT 'group_stage',
    referee_name TEXT,
    mesario_id UUID REFERENCES user_profiles(id),
    assistant_referee_1 TEXT,
    assistant_referee_2 TEXT,
    fourth_official TEXT,
    uniform_home TEXT,
    uniform_away TEXT,
    observations TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS match_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    player_id UUID REFERENCES players(id),
    team_id UUID REFERENCES teams(id),
    type TEXT CHECK (type IN ('gol', 'cartao_amarelo', 'cartao_vermelho', 'substituicao', 'inicio_partida', 'fim_partida')),
    minute INTEGER,
    extra_info TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS news (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    title TEXT,
    content TEXT,
    image_url TEXT,
    published_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS sponsors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    championship_id UUID REFERENCES championships(id) ON DELETE CASCADE,
    name TEXT,
    quota TEXT CHECK (quota IN ('ouro', 'prata', 'bronze')),
    logo_url TEXT,
    website_url TEXT,
    active BOOLEAN DEFAULT true,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS global_sponsors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT,
    logo_url TEXT,
    link_url TEXT,
    active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    quota TEXT DEFAULT 'ouro',
    display_locations TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    user_id UUID REFERENCES user_profiles(id),
    action_type TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID REFERENCES user_profiles(id),
    action_type TEXT,
    target_id UUID,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. MIGRATION (ADICIONAR COLUNAS FALTANTES EM TABELAS EXISTENTES)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE global_sponsors ADD COLUMN IF NOT EXISTS display_locations TEXT[];

-- (Outras colunas padrão do script V5)
ALTER TABLE plans ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS price_monthly NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS price_yearly NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS limits JSONB DEFAULT '{"championships": 1, "teams_per_championship": 8, "users": 1}'::jsonb;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]'::jsonb;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS owner_id UUID;

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES plans(id);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('trial', 'active', 'warning', 'overdue', 'blocked', 'canceled')) DEFAULT 'trial';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS start_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS end_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now() + interval '14 days');
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS custom_limits JSONB;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS role TEXT CHECK (role IN ('super_admin', 'organizer_admin', 'mesario', 'tecnico', 'torcedor'));
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS team_id UUID;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('active', 'blocked')) DEFAULT 'active';

ALTER TABLE championships ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE championships ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE championships ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE championships ADD COLUMN IF NOT EXISTS season TEXT;
ALTER TABLE championships ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE championships ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE championships ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE championships ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE championships ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('rascunho', 'publicado', 'encerrado')) DEFAULT 'rascunho';
ALTER TABLE championships ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE championships ADD COLUMN IF NOT EXISTS banner_url TEXT;
ALTER TABLE championships ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#10B981';
ALTER TABLE championships ADD COLUMN IF NOT EXISTS secondary_color TEXT DEFAULT '#FFFFFF';
ALTER TABLE championships ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE championships ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE championships ADD COLUMN IF NOT EXISTS points_win INTEGER DEFAULT 3;
ALTER TABLE championships ADD COLUMN IF NOT EXISTS points_draw INTEGER DEFAULT 1;
ALTER TABLE championships ADD COLUMN IF NOT EXISTS points_loss INTEGER DEFAULT 0;
ALTER TABLE championships ADD COLUMN IF NOT EXISTS tiebreakers JSONB DEFAULT '["wins", "goal_diff", "goals_for"]'::jsonb;
ALTER TABLE championships ADD COLUMN IF NOT EXISTS zone_config JSONB DEFAULT '{"promotion": 4, "relegation": 1, "gold": 0, "silver": 0, "bronze": 0, "mode": "traditional"}'::jsonb;
ALTER TABLE championships ADD COLUMN IF NOT EXISTS views_page INTEGER DEFAULT 0;
ALTER TABLE championships ADD COLUMN IF NOT EXISTS views_table INTEGER DEFAULT 0;
ALTER TABLE championships ADD COLUMN IF NOT EXISTS regulations_url TEXT;
ALTER TABLE championships ADD COLUMN IF NOT EXISTS regulations_text TEXT;

-- 5. SEED DATA (PLANS)
INSERT INTO plans (name, price_monthly, limits, description)
SELECT 'Gratuito', 0, '{"championships": 1, "teams_per_championship": 8, "users": 1}'::jsonb, 'Ideal para testes e torneios pequenos.'
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE name = 'Gratuito');

INSERT INTO plans (name, price_monthly, limits, description)
SELECT 'Básico', 49.90, '{"championships": 3, "teams_per_championship": 20, "users": 3}'::jsonb, 'Para ligas amadoras em crescimento.'
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE name = 'Básico');

INSERT INTO plans (name, price_monthly, limits, description)
SELECT 'Pró', 99.90, '{"championships": 10, "teams_per_championship": 32, "users": 10}'::jsonb, 'Gestão profissional para grandes ligas.'
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE name = 'Pró');


-- 6. BUCKETS DE STORAGE
INSERT INTO storage.buckets (id, name, public) VALUES ('championship-logos', 'championship-logos', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('team-logos', 'team-logos', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('sponsor-logos', 'sponsor-logos', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('regulations', 'regulations', true) ON CONFLICT (id) DO NOTHING;

-- Policies de Storage (mesmas do V5)
DROP POLICY IF EXISTS "Public Access Championship Logos" ON storage.objects;
CREATE POLICY "Public Access Championship Logos" ON storage.objects FOR SELECT TO public USING (bucket_id = 'championship-logos');
DROP POLICY IF EXISTS "Public Upload Championship Logos" ON storage.objects;
CREATE POLICY "Public Upload Championship Logos" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'championship-logos');

DROP POLICY IF EXISTS "Public Access Team Logos" ON storage.objects;
CREATE POLICY "Public Access Team Logos" ON storage.objects FOR SELECT TO public USING (bucket_id = 'team-logos');
DROP POLICY IF EXISTS "Public Upload Team Logos" ON storage.objects;
CREATE POLICY "Public Upload Team Logos" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'team-logos');

DROP POLICY IF EXISTS "Public Access Sponsor Logos" ON storage.objects;
CREATE POLICY "Public Access Sponsor Logos" ON storage.objects FOR SELECT TO public USING (bucket_id = 'sponsor-logos');
DROP POLICY IF EXISTS "Public Upload Sponsor Logos" ON storage.objects;
CREATE POLICY "Public Upload Sponsor Logos" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'sponsor-logos');

DROP POLICY IF EXISTS "Public Access Regulations" ON storage.objects;
CREATE POLICY "Public Access Regulations" ON storage.objects FOR SELECT TO public USING (bucket_id = 'regulations');
DROP POLICY IF EXISTS "Public Upload Regulations" ON storage.objects;
CREATE POLICY "Public Upload Regulations" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'regulations');

-- 7. DADOS MÍNIMOS (Org Padrão)
INSERT INTO organizations (id, name, slug, logo_url)
SELECT 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Liga GAMA Oficial', 'gama-league', 'https://via.placeholder.com/150/059669/ffffff?text=GAMA'
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');

-- Garante que a org padrão tenha uma assinatura
INSERT INTO subscriptions (organization_id, plan_id, status, end_date)
SELECT 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', (SELECT id FROM plans WHERE name = 'Pró' LIMIT 1), 'active', now() + interval '1 year'
WHERE NOT EXISTS (SELECT 1 FROM subscriptions WHERE organization_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');

-- 8. GATILHO DE USUÁRIO (Trigger para novos cadastros)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  assigned_role text;
  default_org_id uuid;
  user_org_id uuid;
BEGIN
  -- Se for o seu email, vira Super Admin, senão vira Torcedor
  IF new.email = 'gustavogama099@gmail.com' THEN
    assigned_role := 'super_admin';
    default_org_id := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    user_org_id := default_org_id;
  ELSE
    assigned_role := 'torcedor';
    -- Para novos usuários comuns, associamos a uma org padrão pública por enquanto
    user_org_id := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'; 
  END IF;

  INSERT INTO public.user_profiles (id, organization_id, full_name, role, status)
  VALUES (
    new.id, 
    user_org_id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Usuário Novo'), 
    assigned_role,
    'active'
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    full_name = COALESCE(new.raw_user_meta_data->>'full_name', 'Usuário'),
    role = assigned_role,
    status = 'active';
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 9. POLÍTICAS RLS (Segurança - Permissivas para Desenvolvimento/Demo)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public organizations" ON organizations; CREATE POLICY "Public organizations" ON organizations FOR ALL USING (true);

ALTER TABLE championships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public championships" ON championships; CREATE POLICY "Public championships" ON championships FOR ALL USING (true);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public teams" ON teams; CREATE POLICY "Public teams" ON teams FOR ALL USING (true);

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public groups" ON groups; CREATE POLICY "Public groups" ON groups FOR ALL USING (true);

ALTER TABLE players ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public players" ON players; CREATE POLICY "Public players" ON players FOR ALL USING (true);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public matches" ON matches; CREATE POLICY "Public matches" ON matches FOR ALL USING (true);

ALTER TABLE match_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public match_events" ON match_events; CREATE POLICY "Public match_events" ON match_events FOR ALL USING (true);

ALTER TABLE news ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public news" ON news; CREATE POLICY "Public news" ON news FOR ALL USING (true);

ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public sponsors" ON sponsors; CREATE POLICY "Public sponsors" ON sponsors FOR ALL USING (true);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public user_profiles" ON user_profiles; CREATE POLICY "Public user_profiles" ON user_profiles FOR ALL USING (true);

ALTER TABLE global_sponsors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public global_sponsors" ON global_sponsors; CREATE POLICY "Public global_sponsors" ON global_sponsors FOR ALL USING (true);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public audit_logs" ON audit_logs; CREATE POLICY "Public audit_logs" ON audit_logs FOR ALL USING (true);

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public plans" ON plans; CREATE POLICY "Public plans" ON plans FOR ALL USING (true);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public subscriptions" ON subscriptions; CREATE POLICY "Public subscriptions" ON subscriptions FOR ALL USING (true);

ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public admin_audit_logs" ON admin_audit_logs; CREATE POLICY "Public admin_audit_logs" ON admin_audit_logs FOR ALL USING (true);

ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public venues" ON venues; CREATE POLICY "Public venues" ON venues FOR ALL USING (true);

-- 10. Finaliza
NOTIFY pgrst, 'reload config';
`;
-- ============== ENUMS ==============
CREATE TYPE public.task_status AS ENUM ('todo', 'doing', 'done');
CREATE TYPE public.project_role AS ENUM ('owner', 'editor', 'viewer');

-- ============== PROFILES ==============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone authenticated"
  ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Trigger: auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== PROJECTS ==============
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE INDEX projects_owner_idx ON public.projects(owner_id);

CREATE TRIGGER projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== PROJECT MEMBERS (future collaboration) ==============
CREATE TABLE public.project_members (
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.project_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Security definer function to check project access (avoids recursive RLS)
CREATE OR REPLACE FUNCTION public.user_has_project_access(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects WHERE id = _project_id AND owner_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.project_members WHERE project_id = _project_id AND user_id = _user_id
  );
$$;

-- Project policies
CREATE POLICY "Users can view their projects or shared ones"
  ON public.projects FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.user_has_project_access(auth.uid(), id));
CREATE POLICY "Users can create their own projects"
  ON public.projects FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners can update their projects"
  ON public.projects FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Owners can delete their projects"
  ON public.projects FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- Project members policies
CREATE POLICY "Members visible to project participants"
  ON public.project_members FOR SELECT TO authenticated
  USING (public.user_has_project_access(auth.uid(), project_id));
CREATE POLICY "Owners manage members"
  ON public.project_members FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid()));

-- ============== TASKS ==============
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status public.task_status NOT NULL DEFAULT 'todo',
  position DOUBLE PRECISION NOT NULL DEFAULT 1000,
  due_date DATE,
  due_time TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE INDEX tasks_project_idx ON public.tasks(project_id);
CREATE INDEX tasks_status_idx ON public.tasks(project_id, status, position);

CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "View tasks of accessible projects"
  ON public.tasks FOR SELECT TO authenticated
  USING (public.user_has_project_access(auth.uid(), project_id));
CREATE POLICY "Create tasks in accessible projects"
  ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (public.user_has_project_access(auth.uid(), project_id) AND created_by = auth.uid());
CREATE POLICY "Update tasks in accessible projects"
  ON public.tasks FOR UPDATE TO authenticated
  USING (public.user_has_project_access(auth.uid(), project_id));
CREATE POLICY "Delete tasks in accessible projects"
  ON public.tasks FOR DELETE TO authenticated
  USING (public.user_has_project_access(auth.uid(), project_id));

-- ============== CHAT MESSAGES ==============
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX chat_messages_user_idx ON public.chat_messages(user_id, created_at);

CREATE POLICY "Users view own messages"
  ON public.chat_messages FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own messages"
  ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own messages"
  ON public.chat_messages FOR DELETE TO authenticated USING (user_id = auth.uid());
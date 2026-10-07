import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, Field, PageHeader, QueryView } from '../../shared/ui/ui';
import page from '../../shared/ui/page.module.css';
import { ProjectCard } from './ProjectCard';
import { CATEGORIES } from './PostTaskPage';
import { useProjects } from './hooks';

/** Open projects a worker can propose on. Filtering is local; the server decides visibility. */
export function BrowseTasksPage() {
  const projects = useProjects({ status: 'open' });
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');

  const filter = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (list: NonNullable<typeof projects.data>) =>
      list.filter(
        (p) =>
          (!category || p.category === category) &&
          (!needle ||
            [p.title, p.description, ...(p.skills ?? [])].some((text) =>
              text.toLowerCase().includes(needle),
            )),
      );
  }, [search, category]);

  return (
    <>
      <PageHeader
        title="Browse tasks"
        subtitle="Open projects looking for a worker."
      />
      <div className={page.row}>
        <Field id="search" label="Search">
          <input
            id="search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Field>
        <Field id="category" label="Category">
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>
      <QueryView query={projects}>
        {(list) => {
          const shown = filter(list);
          return shown.length === 0 ? (
            <EmptyState
              title={
                list.length
                  ? 'No projects match your filters'
                  : 'No open projects right now'
              }
            />
          ) : (
            <ul className={page.list}>
              {shown.map((project) => (
                <ProjectCard key={project.id} project={project}>
                  <Link to={`/tasks/${project.id}`}>View and propose</Link>
                </ProjectCard>
              ))}
            </ul>
          );
        }}
      </QueryView>
    </>
  );
}

import { Card, CardHeader, PageHeader } from '@/components/ui'
import { requireCompanyAdmin } from '@/lib/auth'
import { ActiveBadge, InlineCreate, SubjectCreate, ToggleRecord } from './client'

export default async function TaxonomyPage() {
  const { supabase } = await requireCompanyAdmin()

  const [types, categories, subjects] = await Promise.all([
    supabase.from('occurrence_types').select('id, name, status, is_system').order('sort_order').order('name'),
    supabase.from('categories').select('id, name, status').order('sort_order').order('name'),
    supabase.from('subjects').select('id, name, status, category_id').order('sort_order').order('name'),
  ])

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Categorias e tipos"
        description="Definem como as manifestações são classificadas — e, depois, como aparecem nos indicadores."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Tipos de manifestação"
            description="Aparecem como primeira escolha no formulário público."
          />
          <div className="flex flex-col gap-3 px-5 py-4">
            <ul className="flex flex-col gap-2">
              {(types.data ?? []).map((type) => (
                <li key={type.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2">
                    {type.name}
                    <ActiveBadge active={type.status === 'ativo'} />
                  </span>
                  <ToggleRecord table="occurrence_types" id={type.id} active={type.status === 'ativo'} />
                </li>
              ))}
            </ul>
            <div className="border-t border-border pt-3">
              <InlineCreate kind="tipo" placeholder="Novo tipo de manifestação" />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Categorias e assuntos" description="Classificação usada na triagem." />
          <div className="flex flex-col gap-4 px-5 py-4">
            {(categories.data ?? []).map((category) => (
              <div key={category.id} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {category.name}
                    <ActiveBadge active={category.status === 'ativo'} />
                  </span>
                  <ToggleRecord table="categories" id={category.id} active={category.status === 'ativo'} />
                </div>
                <ul className="flex flex-col gap-1 border-l border-border pl-3">
                  {(subjects.data ?? [])
                    .filter((s) => s.category_id === category.id)
                    .map((subject) => (
                      <li key={subject.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="flex items-center gap-2">
                          {subject.name}
                          <ActiveBadge active={subject.status === 'ativo'} />
                        </span>
                        <ToggleRecord table="subjects" id={subject.id} active={subject.status === 'ativo'} />
                      </li>
                    ))}
                  <li className="pt-1"><SubjectCreate categoryId={category.id} /></li>
                </ul>
              </div>
            ))}
            <div className="border-t border-border pt-3">
              <InlineCreate kind="categoria" placeholder="Nova categoria" />
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

import { getChannel } from '@/lib/channel'
import { RegistrationForm } from './form'

export default async function RegisterPage(props: PageProps<'/[slug]/registrar'>) {
  const { slug } = await props.params
  const channel = await getChannel(slug)

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Registrar manifestação</h1>
        <p className="text-sm text-muted">{channel.company.name}</p>
      </header>
      <RegistrationForm channel={channel} />
    </main>
  )
}

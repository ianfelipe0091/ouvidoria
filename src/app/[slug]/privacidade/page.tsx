import { getChannel } from '@/lib/channel'

export default async function PrivacyPage(props: PageProps<'/[slug]/privacidade'>) {
  const { slug } = await props.params
  const channel = await getChannel(slug)

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12">
      <h1 className="text-xl font-semibold tracking-tight">Política de privacidade</h1>
      <div className="text-sm leading-relaxed whitespace-pre-wrap text-muted">
        {channel.branding.privacy_policy_text ??
          'Esta ouvidoria ainda não publicou sua política de privacidade.'}
      </div>
    </main>
  )
}

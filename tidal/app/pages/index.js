import Head from 'next/head'
import { Container } from '@chakra-ui/layout'

export default function Home() {
  return (
    <div>
      <Head>
        <title>Tidal UI</title>
        <meta name="description" content="Generated by create next app" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main>
      <Container>
        The Tidal UI is going to be simple
      </Container>
      </main>
    </div>
  )
}

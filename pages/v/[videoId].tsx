import { Box, Flex, Heading, Link } from '@chakra-ui/react'
import axios from 'axios'
import { GetServerSidePropsContext } from 'next'
import Head from 'next/head'

import Player from '../../components/Videos/Player'
import { Video } from '../../types/types'
import { getAPIUrl, getPublicUrl, getThumanailUrl } from '../../utils/urls'

export default function VideoPage({ v }: { v: Video }) {
  const publicURL = getPublicUrl(v?.id)
  const ogDescription = 'Watch this video on bken.io'
  const thumbnailURL = getThumanailUrl(v?.cdnUrl)

  return (
    <>
      <Head>
        <title>{v?.title || 'bken.io'}</title>
        <meta property='og:title' content={v?.title || 'bken.io'} />
        <meta property='og:type' content='website' />
        <meta property='og:url' content={publicURL} />
        <meta property='og:image' content={thumbnailURL} />
        <meta property='og:image:type' content='image/jpeg' />
        <meta property='og:image:width' content='854' />
        <meta property='og:image:height' content='480' />
        <meta property='og:image:alt' content='bken.io' />
        <meta name='description' content={ogDescription} />
        <meta property='og:description' content={ogDescription} />
        {/* Twitter tags */}
        <meta name='twitter:card' content='summary_large_image' />
        <meta property='twitter:url' content={publicURL} />
        <meta name='twitter:title' content={v?.title || 'bken.io'} />
        <meta name='twitter:description' content={ogDescription} />
        <meta name='twitter:image' content={thumbnailURL} />
      </Head>
      <Flex w='100vw' h='100vh' align='center' justify='center' direction='column'>
        <Flex p='2' textAlign='start' w='100%' maxW='90vw'>
          <Heading size='sm' fontWeight='800'>
            {v.title}
          </Heading>
        </Flex>
        <Flex rounded='md' justify='center' overflow='hidden' boxShadow='#0000008a 0 0 40px'>
          <Player
            v={v}
            style={{
              width: '100%',
              height: '100%',
              maxWidth: '90vw',
              maxHeight: '90vh',
              objectFit: 'cover',
            }}
          />
        </Flex>
        <Flex p='2'>
          <Heading size='sm' fontWeight='800'>
            <Link href='https://bken.io'>bken.io</Link>
          </Heading>
        </Flex>
      </Flex>
    </>
  )
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const videoId = context?.params?.videoId
  const { data } = await axios.get(`${getAPIUrl()}/videos/${videoId}`)
  return {
    props: {
      v: data?.payload,
    },
  }
}

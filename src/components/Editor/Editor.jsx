import React from 'react';
import Button from '@material-ui/core/Button';
import Container from '@material-ui/core/Container';
import { Link, useParams, } from 'react-router-dom';
import { gql, useLazyQuery, } from '@apollo/client';
import { Grid, LinearProgress, } from '@material-ui/core';
import Title from './Title';
import VideoStatus from './VideoStatus';
import PublishStatus from './PublishStatus';
import VersionStatus from './VersionStatus';
import DeleteVideoButton from './DeleteVideoButton';

const GET_VIDEO = gql`
  query video($id: String!) {
    video(id: $id) {
      id
      title
      thumbnails
      visibility
      tidal {
        status
        versions {
          status
          preset
          percentCompleted
        }
      }
    }
  }
`;

function VideoPlayer({ versions }) {
  if (versions) {
    const playableLinks = versions.filter((v) => Boolean(v && v.link));

    if (playableLinks[0] && playableLinks[0].link) {
      return (
        <video
          controls
          width='100%'
          style={{ maxHeight: 410, background: 'black' }}
          src={playableLinks[0].link}
        />
      );
    }
  }

  return <div />;
}

function Editor() {
  const { id } = useParams();

  const [getVideo, {
    called, loading, data, error, startPolling,
  }] = useLazyQuery(GET_VIDEO, {
    variables: { id },
  });

  if (id && !called) getVideo();

  if (error) {
    console.error('error here', error);
    return <div> An error occured when loading the video </div>;
  }

  if (data) {
    startPolling(5000);
    return (
      <Container maxWidth='md' style={{ paddingTop: '15px' }}>
        <Grid container spacing={1}>
          <Grid item xs={12} sm={4}>
            {data.video?.thumbnails && (
              <img
                alt='thumbnail'
                style={{
                  borderRadius: '5px',
                  margin: '10px 0px 10px 0px',
                  background: 'grey',
                }}
                width='100%'
                src={data.video.thumbnails[0]}
              />
            )}
          </Grid>
          <Grid item xs={12} sm={8}>
            <Title id={data.video.id} />
            <PublishStatus visibility={data.video.visibility} id={data.video.id} />
          </Grid>
        </Grid>
        {data.video.tidal && (
          <div>
            {/* <VideoPlayer versions={data.video?.tidal?.versions} /> */}
            <VideoStatus status={data.video?.tidal?.status} />
            <VersionStatus versions={data.video?.tidal?.versions} />
          </div>
        )}
        <Grid
          container
          spacing={1}
          direction='row'
          justify='space-between'
          style={{ marginTop: '5px' }}
        >
          <Grid item>
            <DeleteVideoButton id={data.video.id} />
          </Grid>
          <Grid item>
            <Button color='primary' component={Link} variant='outlined' to={`/v/${data.video.id}`}>
              View
            </Button>
          </Grid>
        </Grid>
      </Container>
    );
  }

  return <LinearProgress />;
}

export default Editor;

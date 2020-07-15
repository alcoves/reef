import axios from 'axios';
import styled from 'styled-components';
import chunkFile from '../utils/chunkFile';
import VideoIcon from '@material-ui/icons/MovieOutlined';

import { useHistory } from 'react-router-dom';
import { gql, useMutation } from '@apollo/client';
import React, { useState, useEffect } from 'react';
import { Button, CircularProgress, LinearProgress } from '@material-ui/core';

const CREATE_MULTIPART_UPLOAD = gql`
  mutation createMultipartUpload($input: CreateMultipartUploadInput!) {
    createMultipartUpload(input: $input) {
      key
      urls
      uploadId
      objectId
    }
  }
`;

const COMPLETE_MULTIPART_UPLOAD = gql`
  mutation completeMultipartUpload($input: CompleteMultipartUploadInput!) {
    completeMultipartUpload(input: $input) {
      completed
    }
  }
`;

const UploadContainer = styled.div`
  display: flex;
  align-items: center;
  flex-direction: column;
  padding: 10px 5px 5px 5px;
  justify-content: flex-start;
`;

const UploadRow = styled.div`
  margin: 10px 0px 10px 0px;
  width: 300px;
`;

function Uploader() {
  const history = useHistory();
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  let [bytesUploaded, setBytesUploaded] = useState(0);

  const [
    startUpload,
    { called: creCalled, loading: creLoading, data: creData, error: creError },
  ] = useMutation(CREATE_MULTIPART_UPLOAD);

  const [
    completeUpload,
    { called: comCalled, loading: comLoading, data: comData, error: comError },
  ] = useMutation(COMPLETE_MULTIPART_UPLOAD);

  if (creData && !uploading && !comCalled) {
    setUploading(true);
    Promise.all(
      chunkFile(files[0]).reduce((acc, blob, partIndex) => {
        let lastBytesUploaded = 0;
        acc.push(
          axios.put(creData.createMultipartUpload.urls[partIndex], blob, {
            headers: { 'Content-Type': files[0].type },
            onUploadProgress: e => {
              setBytesUploaded((bytesUploaded += e.loaded - lastBytesUploaded));
              lastBytesUploaded = e.loaded;
            },
          }),
        );

        return acc;
      }, []),
    ).then(res => {
      const parts = res.reduce((acc, { headers }, i) => {
        acc.push({ ETag: headers.etag, PartNumber: i + 1 });
        return acc;
      }, []);

      const { objectId, key, uploadId } = creData.createMultipartUpload;
      console.log('--- COMPLETING VIDEO UPLOAD ---');
      completeUpload({ variables: { input: { objectId, parts, key, uploadId } } });
    });
  }

  console.log({
    creCalled,
    creLoading,
    creData,
    creError,
    comCalled,
    comLoading,
    comData,
    comError,
  });

  if (creError || comError) {
    setUploading(false);
    setBytesUploaded(0);
    setFiles([]);
    console.log('creError', creError);
    console.log('comError', comError);
  }

  if (comData && comCalled && !comLoading && uploading) {
    setUploading(false);
    setBytesUploaded(0);
    setFiles([]);
    console.log('i should be redirecting!', comData);
  }

  useEffect(() => {
    if (files.length) {
      console.log('starting file upload process', files[0]);
      const fileType = files[0].type;
      const fileName = files[0].name;
      const parts = chunkFile(files[0]).length;

      const mbMaxAllowed = 10000;
      if (files[0].size > mbMaxAllowed * 1024 * 1024) {
        alert(`videos must be under ${mbMaxAllowed} mb right now`);
      } else {
        // Load the video into the browser to get the duration
        const video = document.createElement('video');
        video.setAttribute('src', window.URL.createObjectURL(files[0]));
        video.onloadeddata = event => {
          const meta = event.srcElement;
          console.log('Video metadata', meta);
          startUpload({
            variables: {
              input: { parts, fileType, duration: meta.duration, title: fileName },
            },
          });
        };
      }
    }
  }, [files]);

  const fileInputRef = React.createRef();

  if (comData && creData) {
    history.push(`/editor/${creData.createMultipartUpload.objectId}`);
  }

  return (
    <UploadContainer>
      <UploadRow>
        <Button
          fullWidth
          size='large'
          color='primary'
          variant='contained'
          startIcon={<VideoIcon />}
          onClick={() => fileInputRef.current.click()}
          disabled={comLoading || creLoading || uploading}>
          Select Video
        </Button>

        <input
          hidden
          type='file'
          name='video'
          type='file'
          accept='video/mp4,video/x-matroska,video/webm'
          ref={fileInputRef}
          onChange={e => {
            if (!files.length) {
              setFiles([e.target.files[0]]);
            }
          }}
        />

        <UploadRow>
          {bytesUploaded && files[0].size ? (
            <LinearProgress
              color='primary'
              variant='determinate'
              value={((bytesUploaded / files[0].size) * 100).toFixed(0)}
            />
          ) : null}
          {comLoading && <CircularProgress>Completing upload...</CircularProgress>}
        </UploadRow>
      </UploadRow>
    </UploadContainer>
  );
}

export default Uploader;

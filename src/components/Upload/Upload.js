import React from 'react';
import axios from 'axios';
import api from '../../api/api';

import { useHistory } from 'react-router-dom';
import { Button, Progress } from 'semantic-ui-react';
import { useObservable, observer } from 'mobx-react-lite';

export default observer(() => {
  const history = useHistory();
  const state = useObservable({
    fileList: [],
    uploadUrl: '',
    uploadProgress: 0,
    numberOfParts: 0,
    numberOfPartsCompleted: 0,
  });

  const chunkFile = file => {
    let start, end, blob;

    const parts = [];
    const fileSize = file.size;
    const FILE_CHUNK_SIZE = 10000000 * 5; // 50MB
    const NUM_CHUNKS = Math.floor(fileSize / FILE_CHUNK_SIZE) + 1;

    for (let index = 1; index < NUM_CHUNKS + 1; index++) {
      start = (index - 1) * FILE_CHUNK_SIZE;
      end = index * FILE_CHUNK_SIZE;
      blob = index < NUM_CHUNKS ? file.slice(start, end) : file.slice(start);
      parts.push(blob);
    }

    return parts;
  };

  const uploadMultipartFile = async (file, { uploadId, key }) => {
    try {
      const resolvedUploads = await Promise.all(
        chunkFile(file).reduce((acc, blob, partIndex) => {
          state.numberOfParts++;
          acc.push(
            new Promise((resolve, reject) => {
              api({
                method: 'get',
                url: '/uploads/url',
                params: {
                  key,
                  uploadId,
                  partNumber: partIndex + 1,
                },
              })
                .then(({ data }) => {
                  axios
                    .put(data.payload.url, blob, {
                      headers: { 'Content-Type': file.type },
                    })
                    .then(res => {
                      state.numberOfPartsCompleted++;
                      resolve(res);
                    })
                    .catch(reject);
                })
                .catch(reject);
            }),
          );

          return acc;
        }, []),
      );

      const uploadPartsArray = resolvedUploads.reduce((acc, { headers }, i) => {
        acc.push({ ETag: headers.etag, PartNumber: i + 1 });
        return acc;
      }, []);

      await api({
        method: 'post',
        url: '/uploads',
        data: {
          key,
          uploadId,
          parts: uploadPartsArray,
        },
      });

      console.log('upload complete!');
      history.push(`/editor/videos/${key.split('/')[0]}`);
    } catch (error) {
      console.log('Upload Error', error);
    }
  };

  const startUpload = async file => {
    try {
      console.log('starting upload');
      const { data } = await api({
        method: 'post',
        url: '/videos',
        data: {
          fileName: file.name,
          fileType: file.type,
        },
      });

      return uploadMultipartFile(file, data.payload);
    } catch (err) {
      console.log(err);
    }
  };

  let fileInputRef = React.createRef();

  return (
    <div
      style={{
        display: 'flex',
        padding: '20px 5px 5px 5px',
        justifyContent: 'flex-start',
        alignItems: 'center',
        width: '100%',
        height: '100%',
        flexDirection: 'column',
      }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          flexDirection: 'column',
          width: '300px',
        }}>
        <div style={{ margin: '10px 0px 10px 0px' }}>
          <Button
            content='Select Video'
            labelPosition='left'
            icon='video'
            fluid
            onClick={() => fileInputRef.current.click()}
          />
        </div>
        <input
          ref={fileInputRef}
          type='file'
          name='video'
          accept='video/mp4'
          files={state.fileList}
          type='file'
          hidden
          onChange={e => {
            state.uploadProgress = 0;
            state.fileList = [e.target.files[0]];
          }}
        />
        <div style={{ margin: '10px 0px 10px 0px' }}>
          <Button
            fluid
            onClick={() => startUpload(state.fileList[0])}
            disabled={state.fileList.length === 0}>
            Upload
          </Button>
        </div>
        <div style={{ margin: '10px 0px 10px 0px' }}>
          {state.fileList.length ? state.fileList[0].name : null}
        </div>
        <div style={{ margin: '10px 0px 10px 0px' }}>
          {state.numberOfParts ? (
            <Progress
              size='small'
              value={state.numberOfPartsCompleted}
              total={state.numberOfParts}
              progress='ratio'
            />
          ) : null}
        </div>
      </div>
    </div>
  );
});

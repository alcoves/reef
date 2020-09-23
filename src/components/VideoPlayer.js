import qs from 'query-string';
import React, { useEffect, useRef, useState } from 'react';
import { Fade, Menu, MenuItem, IconButton, Slider, LinearProgress, Typography } from '@material-ui/core';
import { PauseOutlined, PlayArrowOutlined, VolumeUpOutlined, VolumeDownOutlined, VolumeOffOutlined, SettingsOutlined, FullscreenOutlined } from '@material-ui/icons';

import styled from 'styled-components';

const Wrapper = styled.div`
  margin: 0px;
  line-height: 0px;
  // overflow: hidden;
  background-color: #000000;
  height: calc(100vh - 300px);
  max-height: calc((9 /  16) * 100vw);
`

const ControlsWrapper = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 98%;
  margin-top: -80px;
`

const Controls = styled.div`
  width: 98%;
`

const LowerControls = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
`

const LowerControlRow = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
`

function volumeIcon(v, muted) {
  if (muted) return <VolumeOffOutlined />
  return v > .50 ? <VolumeUpOutlined /> : <VolumeDownOutlined />
}

const pickUrl = (versions, override) => {
  if (versions) {
    const loadOrder = [
      'libvpx_vp9-2160p',
      'libx264-2160p',
      'libvpx_vp9-1440p',
      'libx264-1440p',
      'libvpx_vp9-1080p',
      'libx264-1080p',
      'libvpx_vp9-720p',
      'libx264-720p',
      'libvpx_vp9-480p',
      'libx264-480p',
    ];
    for (const desiredPreset of loadOrder) {
      for (const v of versions) {
        if (override && override === v.preset && v.link) return v;
        if (desiredPreset === v.preset && v.link) return v;
      }
    }
  }
};

export default function VideoPlayer({ versions }) {
  let idleTimer;

  const vRef = useRef(null);
  const [volume, setVolume] = useState(.25);
  const [progress, setProgress] = useState(0);
  const [settingsEl, setSettingsEl] = React.useState(null);
  const [version, setVersion] = useState();
  const [controlsVisible, setControlsVisible] = useState(false)

  useEffect(() => {
    setVersion(pickUrl(versions))
  }, [])

  useEffect(() => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (controlsVisible && !vRef?.current?.paused) {
        setSettingsEl(null);
        setControlsVisible(false);
      }
    }, 3000)
  }, [controlsVisible])

  if (version) {
    return (
      <Wrapper
        style={{ cursor: controlsVisible ? 'auto' : 'none' }}
        onMouseMove={() => setControlsVisible(true)}
        onMouseEnter={() => setControlsVisible(true)}
        onMouseLeave={() => setControlsVisible(false)}
      >
        <video
          autoPlay
          ref={vRef}
          width='100%'
          height='100%'
          id='bkenVideoPlayer'
          src={version.link}
          onPause={() => {
            setControlsVisible(true);
          }}
          onLoadedMetadata={() => {
            setVolume(vRef.current.volume * 100);

            const { t } = qs.parse(window.location.search);
            if (t) {
              vRef.current.currentTime = t;
              window.location.search = '';
            }
          }}
          onTimeUpdate={(e) => {
            const positionUpdate = (e.target.currentTime / e.target.duration) * 100
            setProgress(positionUpdate)
          }}
          onClick={() => {
            vRef.current.paused ? vRef.current.play() : vRef.current.pause()
          }}
        />
        {controlsVisible && vRef && vRef.current &&
          <Fade in timeout={250}>
            <ControlsWrapper>
              <Controls>
                <Slider onChange={(e, newValue) => {
                  const positionUpdate = (vRef.current.currentTime / vRef.current.duration) * 100
                  setProgress(positionUpdate)
                  const seekPosition = vRef.current.duration * (newValue / 100)
                  vRef.current.currentTime = seekPosition;
                }} value={progress} />

                <LowerControls>
                  <LowerControlRow>
                    <IconButton onClick={() => {
                      vRef.current.paused ? vRef.current.play() : vRef.current.pause()
                    }}>
                      {vRef.current.paused ? <PlayArrowOutlined /> : <PauseOutlined />}
                    </IconButton>

                    <IconButton onClick={() => {
                      if (vRef.current.muted) {
                        vRef.current.volume = .25;
                        vRef.current.muted = false;
                      } else {
                        vRef.current.volume = 0;
                        vRef.current.muted = true;
                      }
                    }}>
                      {volumeIcon(vRef.current.volume, vRef.current.muted)}
                    </IconButton>

                    <Slider style={{ marginLeft: '10px', width: '60px', color: 'white' }} onChange={(e, newValue) => {
                      if (newValue) {
                        setVolume(newValue);
                        vRef.current.muted = false;
                        vRef.current.volume = newValue / 100;
                      } else {
                        setVolume(0);
                        vRef.current.volume = 0;
                        vRef.current.muted = true;
                      }
                    }} value={volume} />

                    {/* <Typography variant='body2'>
                      {`${vRef.current.currentTime} / ${vRef.current.duration}`}
                    </Typography> */}
                  </LowerControlRow>
                  <LowerControlRow>
                    <IconButton onClick={(e) => {
                      setSettingsEl(e.currentTarget)
                    }}>
                      <SettingsOutlined />
                    </IconButton>
                    <Menu
                      keepMounted
                      id="version-selector"
                      anchorEl={settingsEl}
                      open={Boolean(settingsEl)}
                      onClose={() => {
                        setSettingsEl(null)
                      }}
                    >
                      {versions.filter(({ link }) => link).map((v) => (
                        <MenuItem key={v.preset} selected={v.link === vRef.current.src} onClick={(e) => {
                          const currentTime = vRef.current.currentTime
                          vRef.current.src = v.link;
                          vRef.current.currentTime = currentTime;
                          vRef.current.play();
                          setSettingsEl(null)
                        }}>
                          {v.preset.split('-')[1]}
                        </MenuItem>
                      ))}
                    </Menu>
                    <IconButton onClick={(e) => {
                      vRef.current.requestFullscreen();
                    }}>
                      <FullscreenOutlined />
                    </IconButton>
                  </LowerControlRow>
                </LowerControls>
              </Controls>
            </ControlsWrapper>
          </Fade>
        }
      </Wrapper >
    )
  } else {
    return <LinearProgress />
  }
}
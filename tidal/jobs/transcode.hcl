job "new_transcode" {
  priority    = 20
  datacenters = ["dc1"]
  type        = "batch"

  constraint {
    operator  = "="
    value     = "amd64"
    attribute = "${attr.cpu.arch}"
  }

  parameterized {
    payload       = "optional"
    meta_required = [
      "rclone_source_uri",
      "rclone_destination_uri"
    ]
  }

  group "tidal" {
    reschedule {
      attempts = 1
    }

    task "tidal" {
      driver = "docker"

      restart {
        attempts = 1
        mode     = "fail"
      }
      
      template {
        env         = true
        destination = "secrets/.env"
        data        = "{{ key \"secrets/.env\" }}"
      }

      template {
        env         = false
        destination = "/home/nextjs/.config/rclone/rclone.conf"
        data        = "{{ key \"secrets/rclone.conf\" }}"
      }

      config {
        force_pull = false
        image      = "registry.digitalocean.com/bken/tidal:latest"
        command    = "/bin/sh"
        args       = [
          "-c", "yarn start & sleep 5 && curl -X POST -H Content-Type: application/json -d {\"rcloneSourceUri\":\"NOMAD_META_RCLONE_SOURCE_URI\",\"rcloneDestinationUri\":\"${NOMAD_META_RCLONE_DESTINATION_URI}\"} http://localhost:3000/api/jobs/transcode",
        ]

        auth {
          username = "${DO_API_KEY}"
          password = "${DO_API_KEY}"
        }
      }

      resources {
        memory = 8000
        cpu    = 6000
      }
    }
  }
}
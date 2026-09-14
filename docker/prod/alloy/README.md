# Readspace observability

One Grafana Alloy container sends these signals to Grafana Cloud:

- Docker stdout/stderr logs for the Readspace API, worker, and scheduler
- OpenTelemetry traces from the API, worker, and scheduler
- VPS CPU, memory, disk, filesystem, network, load, and uptime metrics
- Per-container CPU, memory, disk, and network metrics from cAdvisor

Alloy, its OTLP receiver, and its debug UI stay on the private Compose network. No
Grafana backend runs on the VPS.

## 1. Create the Grafana Cloud token

1. Sign in to Grafana Cloud and open the Readspace stack.
2. Open **Administration > Users and access > Cloud access policies**. If the UI
   differs, search the Grafana menu for **Cloud access policies**.
3. Create a policy named `readspace-production` with these scopes:
   `logs:write`, `metrics:write`, and `traces:write`.
4. Add a token to the policy and copy the `glc_...` value immediately. Grafana
   displays it only once.

The same token is used as the password for logs, metrics, and OTLP. Keep it only
in Dokploy; do not add it to this repository.

## 2. Copy the three endpoint/username pairs

From the Grafana Cloud portal, open the Readspace stack and copy:

1. **Prometheus / Metrics > Details**
   - Remote write URL, ending in `/api/prom/push`
   - Username / metrics instance ID
2. **Loki / Logs > Details**
   - Push URL, ending in `/loki/api/v1/push`
   - Username / logs instance ID
3. **OpenTelemetry > Configure**
   - OTLP endpoint, normally ending in `/otlp`
   - OTLP instance ID

The three usernames can be different. Copy each from its own Grafana card.

## 3. Add the values to Dokploy

Open the Readspace Compose application's environment settings and add:

```dotenv
GRAFANA_CLOUD_API_KEY=glc_your_token
GRAFANA_CLOUD_LOKI_URL=https://logs-...grafana.net/loki/api/v1/push
GRAFANA_CLOUD_LOKI_USER=your_logs_instance_id
GRAFANA_CLOUD_OTLP_ENDPOINT=https://otlp-gateway-...grafana.net/otlp
GRAFANA_CLOUD_OTLP_INSTANCE_ID=your_otlp_instance_id
GRAFANA_CLOUD_PROMETHEUS_URL=https://prometheus-...grafana.net/api/prom/push
GRAFANA_CLOUD_PROMETHEUS_USER=your_metrics_instance_id
```

Do not surround the values with quotes. Save the environment settings.

## 4. Deploy

Deploy with a rebuild so the server image receives the new OpenTelemetry Python
packages. Do not create a Dokploy domain or public port for Alloy.

The API, worker, and scheduler send OTLP internally to `http://alloy:4318`.
Alloy sends data outward to Grafana Cloud over HTTPS.

## 5. Verify data in Grafana

Exercise the application with an API request and enqueue one normal background
job, then wait about one minute.

Check these in Grafana:

1. **Drilldown > Logs**: filter `service_name = readspace-api` and
   `environment = production`. Application logs are intentionally limited to
   `readspace-api`, `readspace-worker`, and `readspace-scheduler`; infrastructure
   containers remain visible through cAdvisor metrics without shipping their noisy
   stdout streams.
2. **Drilldown > Traces** or **Application Observability**: look for
   `readspace-api`, `readspace-worker`, and `readspace-scheduler`.
3. **Explore > Metrics**: run `node_uname_info` for VPS metrics.
4. **Explore > Metrics**: run `container_last_seen` for container metrics.

If nothing arrives, inspect the `alloy` container logs in Dokploy first. HTTP
`401` or `403` means an endpoint, username, token, or token scope is wrong.

## Security note

cAdvisor requires Alloy to run privileged and mount host runtime paths. Alloy has
no published ports, so its unauthenticated OTLP receiver and UI are not reachable
from the public internet. To remove privileged access later, remove the cAdvisor
component and its cAdvisor-only mounts; logs, traces, and host metrics can remain.

## Suggested first alerts

- Filesystem usage above 85% for 10 minutes
- Available memory below 10% for 10 minutes
- CPU usage above 90% for 15 minutes
- `absent(node_uname_info)` for 5 minutes

Official references:

- <https://grafana.com/docs/grafana-cloud/observe-and-act/send-data/>
- <https://grafana.com/docs/alloy/latest/reference/components/prometheus/prometheus.exporter.unix/>
- <https://grafana.com/docs/alloy/latest/reference/components/prometheus/prometheus.exporter.cadvisor/>
- <https://grafana.com/docs/grafana-cloud/observe-and-act/send-data/alloy/access_permissions/>

# Planificador de cron para odontoflow: supercronic (Aptible) sobre Alpine.
# Ejecuta el crontab con CRON_TZ=America/Lima y dispara los jobs /api/cron/*.

FROM alpine:3.20

# supercronic v0.2.49, binario linux-amd64.
# SHA256 oficial publicado en la API del release de GitHub:
# https://api.github.com/repos/aptible/supercronic/releases/tags/v0.2.49
ENV SUPERCRONIC_URL=https://github.com/aptible/supercronic/releases/download/v0.2.49/supercronic-linux-amd64 \
    SUPERCRONIC_SHA256=a53ae236602c7338aba3fbaff40bda6300eae3b9fedb8261eb06cfe3724430c1 \
    SUPERCRONIC=supercronic-linux-amd64

# La verificación de checksum hace fallar el build si el binario descargado no coincide.
RUN apk add --no-cache curl ca-certificates tzdata \
    && curl -fsSL -o "/tmp/${SUPERCRONIC}" "${SUPERCRONIC_URL}" \
    && echo "${SUPERCRONIC_SHA256}  /tmp/${SUPERCRONIC}" | sha256sum -c - \
    && chmod +x "/tmp/${SUPERCRONIC}" \
    && mv "/tmp/${SUPERCRONIC}" /usr/local/bin/supercronic

# En Alpine el grupo `cron` ya existe (paquete cronie); usamos un nombre propio.
RUN addgroup -S supercronic && adduser -S supercronic -G supercronic

USER supercronic
WORKDIR /etc/supercronic
COPY crontab ./crontab

ENTRYPOINT ["supercronic"]
CMD ["crontab"]

FROM ubuntu:20.04 AS builder

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    g++ \
    make \
    flex \
    libpth-dev \
    default-libmysqlclient-dev \
    gettext \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY src/ ./src/

# Remove stale pre-compiled .o files (cross-architecture artifacts)
RUN find src -name "*.o" -delete

# Copy Makefile.Linux files to Makefile
RUN cp src/libs/Makefile.Linux src/libs/Makefile && \
    cp src/libs/util/Makefile.Linux src/libs/util/Makefile && \
    cp src/libs/net/Makefile.Linux src/libs/net/Makefile && \
    cp src/libs/frame/Makefile.Linux src/libs/frame/Makefile && \
    cp src/libs/cgi/Makefile.Linux src/libs/cgi/Makefile && \
    cp src/libs/runtime/Makefile.Linux src/libs/runtime/Makefile && \
    cp src/libs/database/Makefile.Linux src/libs/database/Makefile && \
    cp src/libs/key/Makefile.Linux src/libs/key/Makefile && \
    cp src/apps/archspace/Makefile.Linux src/apps/archspace/Makefile

# Fix include paths and add -fpermissive for legacy C++ friend injection
RUN find src/libs -name "Makefile" -exec sed -i \
    's|-I/usr/local/include/mysql|-I/usr/include/mysql|g; \
     s|-L/usr/local/lib/mysql|-L/usr/lib/x86_64-linux-gnu|g; \
     s|-I/usr/include/pth||g; \
     s|CFLAGS=-g -Wall|CFLAGS=-g -Wall -fpermissive|g' {} \;
RUN find src/apps/archspace -name "Makefile" -exec sed -i \
    's|-I/usr/local/include/mysql|-I/usr/include/mysql|g; \
     s|-L/usr/local/lib/mysql|-L/usr/lib/x86_64-linux-gnu|g; \
     s|-I/usr/include/pth||g; \
     s|CFLAGS=-g -pipe -Wall|CFLAGS=-g -pipe -Wall -fpermissive|g' {} \;

# Build libarchspace.a
RUN cd src/libs && make 2>&1

# Build archspace binary
RUN cd src/apps/archspace && \
    make archspace 2>&1

# -----------------------------------------------------------
FROM ubuntu:20.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    libpth-dev \
    libmysqlclient21 \
    default-mysql-client \
    gettext \
    && rm -rf /var/lib/apt/lists/*

# Create directories
RUN mkdir -p /etc/archspace /var/archspace/web /var/archspace/msg /var/archspace/script \
    /var/archspace/form /var/log/archspace /var/archspace/news \
    /var/archspace/web/encyclopedia/tech \
    /var/archspace/web/encyclopedia/race \
    /var/archspace/web/encyclopedia/project \
    /var/archspace/web/encyclopedia/component \
    /var/archspace/web/encyclopedia/ship \
    /var/archspace/web/encyclopedia/special_ops

# Copy binary
COPY --from=builder /usr/lib/libarchspace.a /usr/lib/
COPY --from=builder /build/src/apps/archspace/archspace /usr/sbin/archspace

# Copy web templates
COPY src/web/ /var/archspace/web/

# Copy message catalogs
COPY src/apps/archspace/msg/ /var/archspace/msg/

# Copy game script data files (convert CRLF to LF for the script parser)
COPY src/script/ /var/archspace/script/
RUN find /var/archspace/script -type f -exec sed -i 's/\r//' {} \;

# Copy encyclopedia form templates
COPY src/form/ /var/archspace/form/

# Copy database SQL
COPY src/apps/archspace/DB/all.sql /var/archspace/all.sql

# Copy entrypoint
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Copy config
COPY archspace.config /etc/archspace/archspace.config

EXPOSE 12345

ENTRYPOINT ["/docker-entrypoint.sh"]

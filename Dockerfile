FROM denoland/deno:2.1.5

EXPOSE 8000

WORKDIR /app
USER deno

RUN deno install

COPY . .
CMD ["run", "--allow-all", "--env" ,"main.ts"]
FROM node:20-alpine AS build

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .

# Cible OIDC, choisie au build. Vite ne lit que les variables VITE_* presentes dans
# l'environnement au moment du `npm run build` : sans ces ARG/ENV, un --build-arg
# n'atteint jamais le bundle et l'application retombe sur sa deduction d'hote.
ARG VITE_OIDC_AUTHORITY=""
ARG VITE_OIDC_CLIENT_ID=""
ENV VITE_OIDC_AUTHORITY=$VITE_OIDC_AUTHORITY
ENV VITE_OIDC_CLIENT_ID=$VITE_OIDC_CLIENT_ID

RUN npm run build

FROM nginx:alpine
ARG VITE_OIDC_AUTHORITY=""
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
# L'origine du fournisseur d'identite entre dans la politique de securite de contenu.
# Elle est deduite de la meme variable que le bundle : une seule source de verite.
RUN origine=$(printf '%s' "$VITE_OIDC_AUTHORITY" | cut -d/ -f1-3) \
 && sed -i "s|__OIDC_ORIGIN__|${origine}|" /etc/nginx/conf.d/default.conf \
 && nginx -t -c /etc/nginx/nginx.conf
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]

FROM nginx:alpine
COPY . /usr/share/nginx/html

# Configure nginx to listen on port 8000 instead of 80
RUN sed -i 's/listen       80;/listen       8000;/g' /etc/nginx/conf.d/default.conf

EXPOSE 8000
CMD ["nginx", "-g", "daemon off;"]

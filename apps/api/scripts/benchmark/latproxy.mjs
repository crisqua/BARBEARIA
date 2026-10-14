// Proxy TCP que adiciona atraso fixo em cada sentido (RTT simulado = 2*DELAY).
import net from 'node:net';
// Uso: node latproxy.mjs <porta_escuta> <porta_postgres> <atraso_ms_por_sentido>
const [listen, target, delay] = process.argv.slice(2).map(Number);
net.createServer((c) => {
  const s = net.connect(target, '127.0.0.1');
  const pipe = (a, b) => { a.on('data', (d) => setTimeout(() => b.write(d), delay)); a.on('close', () => setTimeout(() => b.destroy(), delay)); a.on('error', () => {}); };
  pipe(c, s); pipe(s, c);
}).listen(listen);

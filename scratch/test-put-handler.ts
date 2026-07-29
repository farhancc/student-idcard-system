import { PUT } from '../src/app/api/templates/[id]/route';

async function test() {
  const body = {
    name: "Springfield Academy Student ID Updated",
    cardWidth: 673,
    cardHeight: 1039,
    frontFields: JSON.stringify([
      {
        field: "rollNumber",
        type: "text",
        x: 100,
        y: 200,
        width: 150,
        height: 25,
        fontSize: 14,
        fontWeight: "bold",
        color: "#111111",
        align: "center",
        suffix: " (Roll)",
      }
    ]),
    backFields: "[]",
  };

  const req = new Request('http://localhost:3000/api/templates/3', {
    method: 'PUT',
    headers: {
      'x-press-id': '1',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const params = Promise.resolve({ id: '3' });

  try {
    const res = await PUT(req, { params });
    console.log('Status:', res.status);
    const json = await res.json();
    console.log('Response JSON:', json);
  } catch (error) {
    console.error('Error executing PUT:', error);
  }
}

test();

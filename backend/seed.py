import requests

S = [
    ("A", "Electrical", "CS Block", "2", "204", "The light outside Lab 204 has not been working since yesterday"),
    ("B", None, "CS Block", "2", "204", "Lab 204 ke bahar bulb nahi jal raha"),
    ("C", None, "CS Block", "2", "204", "corridor light near lab 204 is off, sparking sound from the switch"),
    ("D", None, "Hostel A", "1", "112", "Wi-Fi very slow in room, internet keeps disconnecting"),
    ("E", None, "Hostel A", "1", "112", "wifi not connecting since morning"),
    ("F", None, "Main Block", "Ground", "", "Water leaking from pipe near washroom, floor is flooded"),
    ("G", None, "Library", "1", "", "Projector not working in seminar room"),
]
for s, c, b, f, r, d in S:
    body = dict(student=s, category=c, building=b, floor=f, room=r, description=d)
    print(requests.post("http://localhost:8000/report", json=body).json())

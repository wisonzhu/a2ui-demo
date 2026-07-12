import { A2uiMessageProcessor } from '@a2ui/lit/0.8';
import '@a2ui/lit/ui';

// Standard A2UI messages
const messages = [
  {
    dataModelUpdate: {
      surfaceId: 'main', path: '/',
      contents: [
        { key: 'name', valueString: '' },
        { key: 'email', valueString: '' },
        { key: 'role', valueString: '' },
      ]
    }
  },
  {
    surfaceUpdate: {
      surfaceId: 'main',
      components: [
        { id: 'root', component: { Column: { children: { explicitList: ['title','card'] } } } },
        { id: 'title', component: { Text: { text: { literalString: 'A2UI Standard' }, usageHint: 'h2' } } },
        { id: 'card', component: { Card: { children: { explicitList: ['nameF','emailF','roleF','btn'] } } } },
        { id: 'nameF', component: { TextField: { label: { literalString: 'Name' }, text: { path: '/name' } } } },
        { id: 'emailF', component: { TextField: { label: { literalString: 'Email' }, text: { path: '/email' } } } },
        { id: 'roleF', component: { MultipleChoice: { label: { literalString: 'Role' }, selections: { path: '/role' }, options: [
          { label: { literalString: 'Dev' }, value: { literalString: 'dev' } },
          { label: { literalString: 'Design' }, value: { literalString: 'design' } },
        ] } } },
        { id: 'btn', component: { Button: { child: 'btnT', action: { name: 'submit' } } } },
        { id: 'btnT', component: { Text: { text: { literalString: 'Submit' } } } }
      ]
    }
  },
  { beginRendering: { surfaceId: 'main', root: 'root' } }
];

const processor = new A2uiMessageProcessor();
processor.on('action', (a) => {
  if (a.name === 'submit') alert('A2UI Action: submit');
});
processor.processMessages(messages);

const surface = document.createElement('a2ui-surface');
surface.surfaceId = 'main';
surface.surface = processor.getSurfaces().get('main');
surface.processor = processor;
document.getElementById('root').appendChild(surface);

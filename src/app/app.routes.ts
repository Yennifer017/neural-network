import { Routes } from '@angular/router';
import { Homepage } from './features/homepage/homepage';
import { Layout } from './features/layout/layout';

export const routes: Routes = [
    {
        path: '',
        component: Homepage
    },
    {
        path: 'ai',
        component: Layout,
        children: [
            {
                path: 'try',
                loadComponent: () => 
                    import('./features/use-ai/use-ai').then(c => c.UseAI)
            },
            {
                path: 'train',
                children: [
                    {
                        path: '',
                        loadComponent: () => 
                            import('./features/train-menu/train-menu').then(c => c.TrainMenu)
                    },
                    {
                        path: 'fast',
                        loadComponent: () => 
                            import('./features/train/train').then(c => c.Train)
                    },
                    {
                        path: 'edu',
                        loadComponent: () => 
                            import('./features/train-edu/train-edu').then(c => c.TrainEdu)
                    }
                    
                ]
            },
        ]
    },
    {
        path: '**',
        redirectTo: ''
    }
];
